import { createHash, randomInt } from "node:crypto";
import { prepareScreenshotUpload, type ScreenshotType } from "./claims.server";
import { hashToken, newToken, type FamilyView } from "./family.server";
import { friendlyError, unwrap, type Db, type StudioContext } from "./studio.server";

// Unambiguous letters and digits (no I, L, O, 0 or 1): 31 symbols, 8 characters, about 40 bits. The short code
// is safe only with the database throttle and the invite's limited life; the long link is the strong secret.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/** The one message for every invite that cannot be used, so nothing about the studio or dancer leaks. */
export const INVALID_INVITE = "This invite is not valid. Ask your studio for a new one.";
const NO_ACCESS = "You don't have access to that studio.";

export function newInviteCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join("");
}

/** The code as read out loud or pasted: any case, with or without a dash, spaces ignored. */
export const normalizeCode = (value: string) => value.replace(/[\s-]/g, "").toUpperCase();
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Accept a bare code, a bare token, or the whole `/join/<token>` link, and return what the database expects. */
export function extractSecret(value: string): string {
  const trimmed = value.trim();
  const fromLink = trimmed.split("/join/").pop() ?? trimmed;
  return (fromLink.split(/[?#/]/)[0] ?? "").trim();
}

/** A stable, non-reversible tag for where a request came from, so the database can throttle by source. */
export function sourceTag(forwardedFor: string | null | undefined): string | null {
  const first = forwardedFor?.split(",")[0]?.trim();
  if (!first) return null;
  return createHash("sha256").update(first, "utf8").digest("hex").slice(0, 32);
}

/** Owner: make an invite. The link and code are returned once; only their hashes are stored. */
export async function createInvite(
  { supabase }: StudioContext,
  input: { guardianId: string; days: 1 | 7 | 30 },
  baseUrl: string,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = newToken();
    const code = newInviteCode();
    const result = await supabase.rpc("create_member_invite", {
      p_guardian: input.guardianId,
      p_days: input.days,
      p_token_hash: hashToken(token),
      p_code_hash: hashToken(code),
    });
    // A hash collision on the unique columns is astronomically unlikely; make a fresh secret and go again.
    if (result.error?.code === "23505") continue;
    const [row] = unwrap(result);
    if (!row) throw new Error("Could not create the invite.");
    return {
      url: `${baseUrl.replace(/\/+$/, "")}/join/${token}`,
      code: formatCode(code),
      expiresAt: row.expires_at,
    };
  }
  throw new Error("Could not create the invite. Please try again.");
}

/** Owner: the invite and membership status for their dancers. Never the secrets, never which account joined. */
export async function listMemberAccess(
  { supabase }: StudioContext,
  input: { guardianId?: string | undefined },
) {
  let invites = supabase
    .from("member_invites")
    .select("id, guardian_id, expires_at, redeemed_at, revoked_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  let links = supabase
    .from("member_links")
    .select("id, guardian_id, revoked_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (input.guardianId) {
    invites = invites.eq("guardian_id", input.guardianId);
    links = links.eq("guardian_id", input.guardianId);
  }
  const [inviteRows, linkRows] = await Promise.all([invites, links]);
  return { invites: unwrap(inviteRows), links: unwrap(linkRows) };
}

async function revoke(supabase: Db, table: "member_invites" | "member_links", id: string) {
  const { data, error } = await supabase
    .from(table)
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw friendlyError(error);
  if (!data) throw new Error("That was not found or is already ended.");
  return { revoked: true };
}

export const revokeInvite = ({ supabase }: StudioContext, input: { id: string }) =>
  revoke(supabase, "member_invites", input.id);

export const removeAccess = ({ supabase }: StudioContext, input: { id: string }) =>
  revoke(supabase, "member_links", input.id);

/** Dancer: attach this account to the dancer record the invite was made for. Every failure reads the same. */
export async function redeemInvite(
  { supabase }: StudioContext,
  input: { secret: string },
  source: string | null,
) {
  const secret = extractSecret(input.secret);
  const { data, error } = await supabase.rpc("redeem_member_invite", {
    p_secret: secret,
    ...(source ? { p_source: source } : {}),
  });
  if (error || !data) throw new Error(INVALID_INVITE);
  return { studioName: data };
}

export async function listMyStudios({ supabase }: StudioContext) {
  return unwrap(await supabase.rpc("member_studios"));
}

/** Dancer: their own record at one studio, in the same shape as the family link. */
export async function getMemberView({ supabase }: StudioContext, input: { studioId: string }) {
  const { data, error } = await supabase.rpc("member_view", { p_studio: input.studioId });
  if (error) throw friendlyError(error);
  if (!data) throw new Error(NO_ACCESS);
  return data as unknown as FamilyView;
}

export async function listMemberClaims({ supabase }: StudioContext, input: { studioId: string }) {
  return unwrap(await supabase.rpc("member_claims", { p_studio: input.studioId }));
}

export type MemberClaimInput = {
  studioId: string;
  studentId: string;
  amountPaise: number;
  method: string;
  paidOn: string;
  reference: string | null;
  screenshotType?: ScreenshotType | undefined;
};

/**
 * Dancer: report a payment. The database derives the dancer record from this account's live membership, so
 * the input cannot name someone else's. The service-role client is used only for the screenshot's signed
 * upload URL, and only for the claim the database just created for this caller.
 */
export async function submitMemberClaim(
  { supabase }: StudioContext,
  admin: Db,
  input: MemberClaimInput,
) {
  const claim = unwrap(
    await supabase.rpc("submit_payment_claim_member", {
      p_studio: input.studioId,
      p_student: input.studentId,
      p_amount_paise: input.amountPaise,
      p_method: input.method,
      p_paid_on: input.paidOn,
      ...(input.reference ? { p_reference: input.reference } : {}),
    }),
  );
  const upload = await prepareScreenshotUpload(
    admin,
    claim.studio_id,
    claim.id,
    input.screenshotType,
  );
  return { claimId: claim.id, upload };
}
