import { describe, expect, it } from "vitest";
import { hashToken } from "@/lib/family.server";
import { accessStateOf } from "@/lib/member-access";
import {
  INVALID_INVITE,
  createInvite,
  extractSecret,
  formatCode,
  getMemberView,
  newInviteCode,
  normalizeCode,
  redeemInvite,
  removeAccess,
  sourceTag,
  submitMemberClaim,
} from "@/lib/members.server";
import { claimInput, memberClaimInput } from "@/lib/schemas";
import { fakeSupabase } from "./fake-supabase";

const user = "11111111-1111-4111-8111-111111111111";
const guardian = "22222222-2222-4222-8222-222222222222";
const student = "33333333-3333-4333-8333-333333333333";

describe("invite codes", () => {
  it("makes 8 characters from an unambiguous set, grouped 4-4 for reading out", () => {
    const codes = new Set(Array.from({ length: 200 }, newInviteCode));
    expect(codes.size).toBeGreaterThan(190);
    for (const code of codes) expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/);
    expect(formatCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });

  it("reads a code however it was typed or pasted", () => {
    expect(normalizeCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(extractSecret("https://choreostudio.live/join/abc_DEF-123?x=1")).toBe("abc_DEF-123");
    expect(extractSecret("  ABCD-EFGH ")).toBe("ABCD-EFGH");
  });

  it("tags a request source without keeping the address", () => {
    expect(sourceTag(null)).toBeNull();
    const tag = sourceTag("203.0.113.9, 10.0.0.1");
    expect(tag).toMatch(/^[0-9a-f]{32}$/);
    expect(tag).toBe(sourceTag("203.0.113.9"));
    expect(tag).not.toContain("203");
  });
});

describe("owner invites", () => {
  it("stores only hashes and returns the link and code once", async () => {
    const { client, calls } = fakeSupabase(() => ({
      data: [{ id: "i1", expires_at: "2026-10-24T00:00:00Z" }],
    }));
    const result = await createInvite(
      { supabase: client, userId: user },
      { guardianId: guardian, days: 7 },
      "https://app.test/",
    );
    const token = result.url.replace("https://app.test/join/", "");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const args = calls[0]?.args?.[0] as Record<string, unknown>;
    expect(args).toEqual({
      p_guardian: guardian,
      p_days: 7,
      p_token_hash: hashToken(token),
      p_code_hash: hashToken(result.code.replace("-", "")),
    });
    expect(JSON.stringify(args)).not.toContain(token);
  });

  it("surfaces the database's reason when the dancer already has a login", async () => {
    const { client } = fakeSupabase(() => ({
      error: {
        code: "P0001",
        message: "this dancer already has a login; remove their access before inviting again",
      },
    }));
    await expect(
      createInvite(
        { supabase: client, userId: user },
        { guardianId: guardian, days: 7 },
        "https://app.test",
      ),
    ).rejects.toThrow(/already has a login/);
  });

  it("says whether a dancer has joined, is invited, or has nothing", () => {
    const now = new Date("2026-10-17T00:00:00Z");
    const rows = {
      invites: [
        {
          id: "i-ok",
          guardian_id: "a",
          expires_at: "2026-10-20T00:00:00Z",
          redeemed_at: null,
          revoked_at: null,
        },
        {
          id: "i-old",
          guardian_id: "b",
          expires_at: "2026-10-01T00:00:00Z",
          redeemed_at: null,
          revoked_at: null,
        },
        {
          id: "i-rev",
          guardian_id: "c",
          expires_at: "2026-10-20T00:00:00Z",
          redeemed_at: null,
          revoked_at: "2026-10-16T00:00:00Z",
        },
        {
          id: "i-used",
          guardian_id: "d",
          expires_at: "2026-10-20T00:00:00Z",
          redeemed_at: "2026-10-16T00:00:00Z",
          revoked_at: null,
        },
      ],
      links: [
        { id: "l-d", guardian_id: "d", revoked_at: null, created_at: "2026-10-16T00:00:00Z" },
        {
          id: "l-e",
          guardian_id: "e",
          revoked_at: "2026-10-10T00:00:00Z",
          created_at: "2026-10-01T00:00:00Z",
        },
      ],
    };
    expect(accessStateOf(rows, "a", now)).toMatchObject({ state: "invited", inviteId: "i-ok" });
    for (const id of ["b", "c", "e", "z"])
      expect(accessStateOf(rows, id, now)).toEqual({ state: "none" });
    expect(accessStateOf(rows, "d", now)).toMatchObject({ state: "joined", linkId: "l-d" });
  });

  it("ends a membership by revoking it, and reports one that is already gone", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: { id: "l1" } }));
    await removeAccess({ supabase: client, userId: user }, { id: "l1" });
    expect(calls[0]?.table).toBe("member_links");
    const none = fakeSupabase(() => ({ data: null }));
    await expect(
      removeAccess({ supabase: none.client, userId: user }, { id: "l1" }),
    ).rejects.toThrow(/not found or is already ended/);
  });
});

describe("dancer side", () => {
  it("gives one message for every invite that cannot be used", async () => {
    for (const result of [
      { data: null },
      { error: { code: "XX000", message: "relation member_invites is broken" } },
    ]) {
      const { client } = fakeSupabase(() => result);
      await expect(
        redeemInvite({ supabase: client, userId: user }, { secret: "ABCD-EFGH" }, "src"),
      ).rejects.toThrow(INVALID_INVITE);
    }
  });

  it("passes the cleaned secret and the source tag to the database", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: "Rhythm House" }));
    const result = await redeemInvite(
      { supabase: client, userId: user },
      { secret: "https://app.test/join/abc_DEF-123" },
      "tag",
    );
    expect(result).toEqual({ studioName: "Rhythm House" });
    expect(calls[0]?.args?.[0]).toEqual({ p_secret: "abc_DEF-123", p_source: "tag" });
  });

  it("refuses a studio the account does not belong to without saying why", async () => {
    const { client } = fakeSupabase(() => ({ data: null }));
    await expect(
      getMemberView({ supabase: client, userId: user }, { studioId: user }),
    ).rejects.toThrow(/don't have access/);
  });

  it("sends the claim to the member function with a studio and no guardian, then arranges the screenshot", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: { id: "c1", studio_id: user } }));
    const admin = fakeSupabase(() => ({ data: null }));
    const result = await submitMemberClaim({ supabase: client, userId: user }, admin.client, {
      studioId: user,
      studentId: student,
      amountPaise: 150000,
      method: "upi",
      paidOn: "2026-10-06",
      reference: "UTR1",
    });
    expect(result).toEqual({ claimId: "c1", upload: null });
    expect(calls[0]?.fn).toBe("submit_payment_claim_member");
    expect(calls[0]?.args?.[0]).toEqual({
      p_studio: user,
      p_student: student,
      p_amount_paise: 150000,
      p_method: "upi",
      p_paid_on: "2026-10-06",
      p_reference: "UTR1",
    });
    expect(admin.calls).toHaveLength(0);
  });
});

describe("claim schemas", () => {
  const base = { studentId: student, amountPaise: 1000, method: "upi", paidOn: "2026-10-06" };

  it("needs a reference for UPI and bank on both doors, but not for cash", () => {
    expect(memberClaimInput.safeParse({ ...base, studioId: user, reference: "" }).success).toBe(
      false,
    );
    expect(memberClaimInput.safeParse({ ...base, studioId: user, reference: "UTR9" }).success).toBe(
      true,
    );
    expect(
      memberClaimInput.safeParse({ ...base, studioId: user, method: "cash", reference: "" })
        .success,
    ).toBe(true);
    expect(claimInput.safeParse({ ...base, token: "t", reference: "" }).success).toBe(false);
  });

  it("has no way to name a guardian", () => {
    const parsed = memberClaimInput.safeParse({
      ...base,
      studioId: user,
      reference: "R",
      guardianId: guardian,
    });
    expect(parsed.success && "guardianId" in parsed.data).toBe(false);
  });
});
