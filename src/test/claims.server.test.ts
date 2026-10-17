import { describe, expect, it, vi } from "vitest";
import { claimInput, MAX_SCREENSHOT_BYTES } from "@/lib/schemas";
import {
  confirmClaim,
  getClaimScreenshotUrl,
  listMyClaims,
  purgeScreenshots,
  rejectClaim,
  resolveLink,
  submitClaim,
} from "@/lib/claims.server";
import { hashToken } from "@/lib/family.server";
import type { Db } from "@/lib/studio.server";
import { fakeSupabase } from "./fake-supabase";

const user = "11111111-1111-4111-8111-111111111111";
const studio = "22222222-2222-4222-8222-222222222222";
const guardian = "33333333-3333-4333-8333-333333333333";
const student = "44444444-4444-4444-8444-444444444444";
const claimId = "55555555-5555-4555-8555-555555555555";
const token = "A".repeat(43);

/** A service-role stand-in: the family link lookup, the claim function, and storage. */
function adminStub(
  options: { revoked?: boolean; storageFails?: boolean; pathUpdateFails?: boolean } = {},
) {
  const storage = {
    createSignedUploadUrl: vi.fn(async (path: string) =>
      options.storageFails
        ? { data: null, error: new Error("down") }
        : { data: { path, token: "upload-token", signedUrl: "https://x" }, error: null },
    ),
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://signed" }, error: null })),
    remove: vi.fn(async () => ({ data: [], error: null })),
  };
  const { client, calls } = fakeSupabase((call) => {
    if (call.table === "family_links")
      return options.revoked
        ? { data: null }
        : { data: { studio_id: studio, guardian_id: guardian } };
    if (call.fn === "submit_payment_claim") return { data: { id: claimId } };
    if (call.fn === "claim_screenshots_to_purge")
      return {
        data: [
          { claim_id: "c1", screenshot_path: "s/c1.png" },
          { claim_id: "c2", screenshot_path: "s/c2.jpg" },
        ],
      };
    if (
      call.table === "payment_claims" &&
      options.pathUpdateFails &&
      call.steps.some(([n]) => n === "update")
    )
      return { error: { code: "XX000", message: "down" } };
    if (call.table === "payment_claims") return { data: { screenshot_path: "s/old.png" } };
    return {};
  });
  const admin = Object.assign(client, { storage: { from: () => storage } }) as unknown as Db;
  return { admin, calls, storage };
}

const base = {
  token,
  studentId: student,
  amountPaise: 150000,
  method: "upi" as const,
  paidOn: "2026-10-06",
  reference: "UTR-1",
};

describe("claim form validation", () => {
  it("needs a reference for UPI and bank but not for cash", () => {
    expect(claimInput.safeParse({ ...base, reference: "" }).success).toBe(false);
    expect(claimInput.safeParse({ ...base, method: "bank", reference: "  " }).success).toBe(false);
    expect(claimInput.safeParse({ ...base, method: "cash", reference: "" }).success).toBe(true);
  });

  it("only accepts PNG, JPEG and WebP screenshots, and caps size at 5 MB", () => {
    expect(claimInput.safeParse({ ...base, screenshotType: "image/png" }).success).toBe(true);
    expect(claimInput.safeParse({ ...base, screenshotType: "image/gif" }).success).toBe(false);
    expect(claimInput.safeParse({ ...base, screenshotType: "application/pdf" }).success).toBe(
      false,
    );
    expect(MAX_SCREENSHOT_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("resolveLink", () => {
  it("answers a malformed, unknown or revoked link the same way", async () => {
    await expect(resolveLink(adminStub().admin, "short")).rejects.toThrow(/not valid/);
    await expect(resolveLink(adminStub({ revoked: true }).admin, token)).rejects.toThrow(
      "This link is not valid. Ask your studio for a new one.",
    );
  });

  it("looks the link up by the hash of the token, never the token itself", async () => {
    const { admin, calls } = adminStub();
    expect(await resolveLink(admin, token)).toEqual({ studioId: studio, guardianId: guardian });
    const eq = calls[0]?.steps.filter(([name]) => name === "eq").map(([, args]) => args);
    expect(eq).toContainEqual(["token_hash", hashToken(token)]);
    expect(JSON.stringify(calls)).not.toContain(token);
  });
});

describe("submitClaim", () => {
  it("stores a pending claim for the contact the link names, without a screenshot upload by default", async () => {
    const { admin, calls, storage } = adminStub();
    const result = await submitClaim(admin, { ...base });
    expect(result).toEqual({ claimId, upload: null });
    const rpc = calls.find((c) => c.fn === "submit_payment_claim");
    expect(rpc?.args).toEqual([
      {
        p_guardian: guardian,
        p_student: student,
        p_amount_paise: 150000,
        p_method: "upi",
        p_paid_on: "2026-10-06",
        p_reference: "UTR-1",
      },
    ]);
    expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("issues a signed upload URL under the studio's folder when a screenshot is wanted", async () => {
    const { admin, storage } = adminStub();
    const result = await submitClaim(admin, { ...base, screenshotType: "image/jpeg" });
    expect(storage.createSignedUploadUrl).toHaveBeenCalledWith(`${studio}/${claimId}.jpg`);
    expect(result.upload).toEqual({ path: `${studio}/${claimId}.jpg`, token: "upload-token" });
  });

  it("hands out no upload token when the screenshot path could not be stored", async () => {
    const { admin } = adminStub({ pathUpdateFails: true });
    expect(await submitClaim(admin, { ...base, screenshotType: "image/png" })).toEqual({
      claimId,
      upload: null,
    });
  });

  it("still saves the claim when storage is unavailable", async () => {
    const { admin } = adminStub({ storageFails: true });
    expect(await submitClaim(admin, { ...base, screenshotType: "image/png" })).toEqual({
      claimId,
      upload: null,
    });
  });

  it("refuses an invalid link before touching the database", async () => {
    const { admin, calls } = adminStub({ revoked: true });
    await expect(submitClaim(admin, { ...base })).rejects.toThrow(/not valid/);
    expect(calls.some((c) => c.fn === "submit_payment_claim")).toBe(false);
  });

  it("passes through the database's readable reasons", async () => {
    const { client } = fakeSupabase((call) =>
      call.table === "family_links"
        ? { data: { studio_id: studio, guardian_id: guardian } }
        : {
            error: {
              code: "P0001",
              message:
                "five payments are already waiting to be checked; the studio needs to review them first",
            },
          },
    );
    const admin = Object.assign(client, { storage: { from: () => ({}) } }) as unknown as Db;
    await expect(submitClaim(admin, { ...base })).rejects.toThrow(
      /five payments are already waiting/,
    );
  });
});

describe("owner decisions and screenshots", () => {
  it("deletes the screenshot once a claim is confirmed or rejected", async () => {
    const owner = fakeSupabase((call) =>
      call.fn === "confirm_payment_claim" || call.fn === "reject_payment_claim"
        ? { data: { id: claimId } }
        : {},
    );
    const confirmStub = adminStub();
    await confirmClaim({ supabase: owner.client, userId: user }, confirmStub.admin, {
      claimId,
      acknowledgeExcess: false,
    });
    expect(confirmStub.storage.remove).toHaveBeenCalledWith(["s/old.png"]);

    const rejectStub = adminStub();
    await rejectClaim({ supabase: owner.client, userId: user }, rejectStub.admin, {
      claimId,
      reason: "No such transfer",
    });
    expect(rejectStub.storage.remove).toHaveBeenCalledWith(["s/old.png"]);
  });

  it("keeps the stored path after a decision so the purge job can sweep a late upload", async () => {
    const owner = fakeSupabase(() => ({ data: { id: claimId } }));
    const stub = adminStub();
    await confirmClaim({ supabase: owner.client, userId: user }, stub.admin, {
      claimId,
      acknowledgeExcess: false,
    });
    const cleared = stub.calls.some(
      (call) =>
        call.table === "payment_claims" &&
        call.steps.some(
          ([name, args]) => name === "update" && JSON.stringify(args).includes("screenshot_path"),
        ),
    );
    expect(cleared).toBe(false);
  });

  it("sends the adjusted amount and acknowledgment only when given", async () => {
    const owner = fakeSupabase(() => ({ data: { id: claimId } }));
    await confirmClaim({ supabase: owner.client, userId: user }, adminStub().admin, {
      claimId,
      amountPaise: 100000,
      acknowledgeExcess: true,
    });
    expect(owner.calls[0]?.args).toEqual([
      { p_claim: claimId, p_amount_paise: 100000, p_acknowledge_excess: true },
    ]);
  });

  it("opens a screenshot only through the owner's own claim, for 60 seconds", async () => {
    const owner = fakeSupabase(() => ({ data: { screenshot_path: "s/old.png" } }));
    const stub = adminStub();
    expect(
      await getClaimScreenshotUrl({ supabase: owner.client, userId: user }, stub.admin, {
        claimId,
      }),
    ).toEqual({ url: "https://signed" });
    expect(stub.storage.createSignedUrl).toHaveBeenCalledWith("s/old.png", 60);

    const none = fakeSupabase(() => ({ data: null }));
    await expect(
      getClaimScreenshotUrl({ supabase: none.client, userId: user }, adminStub().admin, {
        claimId,
      }),
    ).rejects.toThrow(/no screenshot/);
  });
});

describe("listMyClaims and purge", () => {
  it("lists only the link's own contact's claims", async () => {
    const { admin, calls } = adminStub();
    await listMyClaims(admin, token);
    const claimsCall = calls.find((c) => c.table === "payment_claims");
    expect(claimsCall?.steps.find(([name]) => name === "eq")?.[1]).toEqual([
      "guardian_id",
      guardian,
    ]);
  });

  it("removes the files of every claim the database lists and clears their paths", async () => {
    const { admin, calls, storage } = adminStub();
    expect(await purgeScreenshots(admin, 30)).toEqual({ purged: 2 });
    expect(storage.remove).toHaveBeenCalledWith(["s/c1.png", "s/c2.jpg"]);
    const update = calls.find(
      (c) => c.table === "payment_claims" && c.steps.some(([n]) => n === "update"),
    );
    expect(update?.steps.find(([name]) => name === "in")?.[1]).toEqual(["id", ["c1", "c2"]]);
  });
});
