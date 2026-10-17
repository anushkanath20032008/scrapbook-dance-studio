import { describe, expect, it } from "vitest";
import {
  createFamilyLink,
  getFamilyView,
  hashToken,
  newToken,
  revokeFamilyLink,
} from "@/lib/family.server";
import { fakeSupabase, stepsOf } from "./fake-supabase";

const user = "11111111-1111-4111-8111-111111111111";
const guardian = "22222222-2222-4222-8222-222222222222";
const student = "33333333-3333-4333-8333-333333333333";
const link = { studio_id: user, guardian_id: guardian };
const validToken = newToken();

describe("tokens", () => {
  it("makes 43-character URL-safe tokens that never repeat, and hashes them one way", () => {
    const tokens = new Set(Array.from({ length: 50 }, newToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken("a")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});

describe("family link management", () => {
  it("stores only the hash and returns the full link once", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: { id: "l1" } }));
    const { url } = await createFamilyLink(
      { supabase: client, userId: user },
      { guardianId: guardian },
      "https://app.test/",
    );
    const token = url.replace("https://app.test/family/", "");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const inserted = stepsOf(calls[0], "insert")[0]?.[0] as Record<string, unknown>;
    expect(inserted).toEqual({
      studio_id: user,
      guardian_id: guardian,
      token_hash: hashToken(token),
    });
    expect(JSON.stringify(inserted)).not.toContain(token);
  });

  it("says so when a link to revoke does not exist or is already revoked", async () => {
    const { client } = fakeSupabase(() => ({ data: null }));
    await expect(
      revokeFamilyLink({ supabase: client, userId: user }, { id: "l1" }),
    ).rejects.toThrow("not found or is already revoked");
  });
});

describe("getFamilyView", () => {
  it("gives the same answer for a malformed, unknown or revoked token", async () => {
    const message = "This link is not valid";
    const { client, calls } = fakeSupabase(() => ({ data: null }));
    await expect(getFamilyView(client, "short")).rejects.toThrow(message);
    expect(calls).toHaveLength(0);
    await expect(getFamilyView(client, validToken)).rejects.toThrow(message);
    const filters = calls[0].steps.map(([name]) => name);
    expect(filters).toContain("is");
    expect(stepsOf(calls[0], "eq")[0]).toEqual(["token_hash", hashToken(validToken)]);
  });

  it("returns a fixed set of fields, scoped to the link's guardian and studio", async () => {
    const { client, calls } = fakeSupabase((call) => {
      switch (call.table ?? call.fn) {
        case "family_links":
          return { data: link };
        case "studio_profiles":
          return { data: { studio_name: "Rhythm House" } };
        case "guardians":
          return { data: { name: "Meera" } };
        case "students":
          return { data: [{ id: student, name: "Aarav" }] };
        case "batch_members":
          return { data: [{ student_id: student, batch_id: "b1" }] };
        case "batches":
          return {
            data: [
              {
                id: "b1",
                name: "Hip hop",
                weekdays: [2],
                starts_at: "17:00",
                ends_at: "18:00",
                trainer_name: "Kabir",
                room: "A",
              },
            ],
          };
        case "attendance_records":
          return { data: [{ student_id: student, present: true, session_id: "s1" }] };
        case "class_sessions":
          return { data: [{ id: "s1", session_on: "2026-10-13" }] };
        case "charges":
          return {
            data: [
              {
                id: "c1",
                student_id: student,
                period: "2026-10-01",
                due_on: "2026-10-05",
                amount_paise: 90000,
                fee_plan_name: "Monthly",
              },
            ],
          };
        case "payments":
          return {
            data: [
              {
                id: "p1",
                student_id: student,
                amount_paise: 30000,
                method: "upi",
                paid_on: "2026-10-06",
              },
            ],
          };
        case "student_ledger_status":
          return {
            data: [
              {
                student_id: student,
                charge_id: "c1",
                status: "overdue",
                outstanding_paise: 60000,
                allocated_paise: 30000,
              },
            ],
          };
        default:
          return {};
      }
    });
    const view = await getFamilyView(client, validToken);
    expect(view).toMatchObject({
      studio_name: "Rhythm House",
      guardian_name: "Meera",
      balance_paise: 60000,
    });
    expect(view.students[0]).toMatchObject({
      name: "Aarav",
      balance_paise: 60000,
      charges: [{ status: "overdue", amount_paise: 90000 }],
      attendance: [{ date: "2026-10-13", present: true }],
      batches: [{ name: "Hip hop" }],
    });
    // Nothing from the link or other tables leaks into the response.
    expect(JSON.stringify(view)).not.toContain(hashToken(validToken));
    expect(JSON.stringify(view)).not.toContain(user);
    // Every data query is scoped to the link's studio, and students to its guardian.
    const scoped = calls.filter(
      (call) => call.table && call.table !== "family_links" && call.table !== "studio_profiles",
    );
    for (const call of scoped) {
      const eqs = stepsOf(call, "eq").map(
        ([column, value]) => `${String(column)}=${String(value)}`,
      );
      expect(eqs, call.table).toContain(`studio_id=${user}`);
    }
    const studentsCall = calls.find((call) => call.table === "students");
    expect(stepsOf(studentsCall ?? calls[0], "eq")).toContainEqual(["guardian_id", guardian]);
    const statusCall = calls.find((call) => call.fn === "student_ledger_status");
    expect(statusCall?.args).toEqual([{ p_period: "2026-10-01", p_student_ids: [student] }]);
  });

  it("returns an empty view for a guardian with no children", async () => {
    const { client } = fakeSupabase((call) => {
      if (call.table === "family_links") return { data: link };
      if (call.table === "students") return { data: [] };
      if (call.table === "studio_profiles") return { data: { studio_name: "Rhythm House" } };
      return {};
    });
    expect(await getFamilyView(client, validToken)).toMatchObject({
      students: [],
      balance_paise: 0,
    });
  });
});

describe("getFamilyView balance", () => {
  it("counts every entry in the balance even when only the newest are listed", async () => {
    const charges = Array.from({ length: 30 }, (_, i) => ({
      id: `c${i}`,
      student_id: student,
      period: `2026-${String((i % 12) + 1).padStart(2, "0")}-01`,
      due_on: "2026-01-05",
      amount_paise: 100,
      fee_plan_name: "Monthly",
    }));
    const { client } = fakeSupabase((call) => {
      if (call.table === "family_links") return { data: link };
      if (call.table === "students") return { data: [{ id: student, name: "Aarav" }] };
      if (call.table === "charges") return { data: charges };
      if (call.table === "payments") return { data: [] };
      if (call.fn === "student_ledger_status") return { data: [] };
      return { data: [] };
    });
    const view = await getFamilyView(client, validToken);
    expect(view.balance_paise).toBe(3000);
    expect(view.students[0]?.charges).toHaveLength(24);
  });
});
