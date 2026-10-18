import { hashToken } from "./family.server";
import { SCREENSHOT_BUCKET } from "./schemas";
import { friendlyError, unwrap, type Db, type StudioContext } from "./studio.server";

export const RETENTION_DAYS = 30;
const NOT_FOUND = "This link is not valid. Ask your studio for a new one.";
const tokenShape = /^[A-Za-z0-9_-]{43}$/;

/** PNG, JPEG and WebP only; the bucket itself also refuses anything else and anything over 5 MB. */
export const screenshotExtensions = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;
export type ScreenshotType = keyof typeof screenshotExtensions;

/** The studio and contact a family link names. Unknown, malformed and revoked links all get the same answer. */
export async function resolveLink(admin: Db, token: string) {
  if (!tokenShape.test(token)) throw new Error(NOT_FOUND);
  const { data, error } = await admin
    .from("family_links")
    .select("studio_id, guardian_id")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw friendlyError(error);
  if (!data) throw new Error(NOT_FOUND);
  return { studioId: data.studio_id, guardianId: data.guardian_id };
}

/**
 * A one-time signed upload URL for a claim's screenshot, or null when none was wanted or it could not be set up.
 * The path is stored on the claim first, so a file never lands untracked.
 */
export async function prepareScreenshotUpload(
  admin: Db,
  studioId: string,
  claimId: string,
  type: ScreenshotType | undefined,
) {
  if (!type) return null;
  const path = `${studioId}/${claimId}.${screenshotExtensions[type]}`;
  const signed = await admin.storage.from(SCREENSHOT_BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) return null;
  const saved = await admin.from("payment_claims").update({ screenshot_path: path }).eq("id", claimId);
  return saved.error ? null : { path, token: signed.data.token };
}

export type ClaimInput = {
  token: string;
  studentId: string;
  amountPaise: number;
  method: string;
  paidOn: string;
  reference: string | null;
  screenshotType?: ScreenshotType | undefined;
};

/**
 * A dancer reports a payment from their private link. It is stored as a pending claim and changes nothing
 * until the studio confirms it. When a screenshot is wanted, a one-time signed upload URL for the private
 * bucket is returned; the file never passes through this server and the browser cannot read the bucket.
 */
export async function submitClaim(admin: Db, input: ClaimInput) {
  const { studioId, guardianId } = await resolveLink(admin, input.token);
  const claim = unwrap(
    await admin.rpc("submit_payment_claim", {
      p_guardian: guardianId,
      p_student: input.studentId,
      p_amount_paise: input.amountPaise,
      p_method: input.method,
      p_paid_on: input.paidOn,
      ...(input.reference ? { p_reference: input.reference } : {}),
    }),
  );

  const upload = await prepareScreenshotUpload(admin, studioId, claim.id, input.screenshotType);
  return { claimId: claim.id, upload };
}

/** The contact's own recent claims, so the link can show what is waiting and what was decided. */
export async function listMyClaims(admin: Db, token: string) {
  const { guardianId } = await resolveLink(admin, token);
  return unwrap(
    await admin
      .from("payment_claims")
      .select("id, student_id, amount_paise, method, paid_on, status, decision_reason, created_at")
      .eq("guardian_id", guardianId)
      .order("created_at", { ascending: false })
      .limit(10),
  );
}

/**
 * Remove claims' screenshots from storage. The purge job also clears the stored path; a decision keeps it,
 * so the next purge run sweeps a file whose signed upload landed after the decision.
 */
export async function removeScreenshots(
  admin: Db,
  claims: { id: string; path: string }[],
  { clearPath }: { clearPath: boolean } = { clearPath: true },
) {
  if (claims.length === 0) return { removed: 0 };
  const result = await admin.storage
    .from(SCREENSHOT_BUCKET)
    .remove(claims.map((claim) => claim.path));
  if (result.error) throw new Error("Could not delete the screenshot files.");
  if (!clearPath) return { removed: claims.length };
  const { error } = await admin
    .from("payment_claims")
    .update({ screenshot_path: null })
    .in(
      "id",
      claims.map((claim) => claim.id),
    );
  if (error) throw friendlyError(error);
  return { removed: claims.length };
}

async function clearScreenshotFor(admin: Db, claimId: string) {
  const { data } = await admin
    .from("payment_claims")
    .select("screenshot_path")
    .eq("id", claimId)
    .maybeSingle();
  if (data?.screenshot_path)
    await removeScreenshots(admin, [{ id: claimId, path: data.screenshot_path }], {
      clearPath: false,
    });
}

/** Pending claims beside what each dancer owes, with a flag for a reference number already seen. */
export async function listClaimQueue({ supabase }: StudioContext) {
  return unwrap(await supabase.rpc("payment_claim_queue"));
}

/** Confirm a claim, optionally for a different amount. Its screenshot is deleted once it is decided. */
export async function confirmClaim(
  { supabase }: StudioContext,
  admin: Db,
  input: { claimId: string; amountPaise?: number | undefined; acknowledgeExcess: boolean },
) {
  const claim = unwrap(
    await supabase.rpc("confirm_payment_claim", {
      p_claim: input.claimId,
      ...(input.amountPaise ? { p_amount_paise: input.amountPaise } : {}),
      p_acknowledge_excess: input.acknowledgeExcess,
    }),
  );
  await clearScreenshotFor(admin, claim.id).catch(() => undefined);
  return claim;
}

export async function rejectClaim(
  { supabase }: StudioContext,
  admin: Db,
  input: { claimId: string; reason: string },
) {
  const claim = unwrap(
    await supabase.rpc("reject_payment_claim", { p_claim: input.claimId, p_reason: input.reason }),
  );
  await clearScreenshotFor(admin, claim.id).catch(() => undefined);
  return claim;
}

/** A 60-second link to view one claim's screenshot. The claim is read with the owner's rights first. */
export async function getClaimScreenshotUrl(
  { supabase }: StudioContext,
  admin: Db,
  input: { claimId: string },
) {
  const { data, error } = await supabase
    .from("payment_claims")
    .select("screenshot_path")
    .eq("id", input.claimId)
    .maybeSingle();
  if (error) throw friendlyError(error);
  if (!data?.screenshot_path) throw new Error("There is no screenshot for this claim.");
  const signed = await admin.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrl(data.screenshot_path, 60);
  if (signed.error || !signed.data) throw new Error("The screenshot could not be opened.");
  return { url: signed.data.signedUrl };
}

/** Delete the screenshots of decided claims and of claims left pending past the retention period. */
export async function purgeScreenshots(admin: Db, days = RETENTION_DAYS) {
  const rows = unwrap(await admin.rpc("claim_screenshots_to_purge", { p_days: days }));
  const result = await removeScreenshots(
    admin,
    rows.map((row) => ({ id: row.claim_id, path: row.screenshot_path })),
  );
  return { purged: result.removed };
}
