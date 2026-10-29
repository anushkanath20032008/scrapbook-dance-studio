import { describe, expect, it } from "vitest";
import {
  addToBatch,
  getRoster,
  listBatches,
  removeFromBatch,
  saveBatch,
} from "@/lib/batches.server";
import { assignFeePlan, listFeePlans, saveFeePlan } from "@/lib/fees.server";
import { batchInput, feePlanInput } from "@/lib/schemas";
import { fakeSupabase, stepsOf } from "./fake-supabase";

const user = "11111111-1111-4111-8111-111111111111";
const batchId = "22222222-2222-4222-8222-222222222222";
const studentId = "33333333-3333-4333-8333-333333333333";
const planId = "44444444-4444-4444-8444-444444444444";

describe("batch and fee plan input rules", () => {
  it("sorts and de-duplicates weekdays and rejects days outside 0 to 6", () => {
    expect(batchInput.parse({ name: "Hip Hop", weekdays: [5, 2, 2] }).weekdays).toEqual([2, 5]);
    expect(batchInput.safeParse({ name: "Hip Hop", weekdays: [7] }).success).toBe(false);
  });

  it("requires a class to end after it starts and turns blank text into null", () => {
    expect(batchInput.safeParse({ name: "A", startsAt: "18:00", endsAt: "17:00" }).success).toBe(
      false,
    );
    const parsed = batchInput.parse({ name: "A", startsAt: "17:00", endsAt: "18:30", room: "  " });
    expect(parsed).toMatchObject({
      startsAt: "17:00",
      endsAt: "18:30",
      room: null,
      trainerName: null,
    });
  });

  it("accepts whole paise only and bounds classes per week", () => {
    expect(feePlanInput.parse({ name: "Plan", amountPaise: 900000 }).classesPerWeek).toBeNull();
    for (const bad of [
      { amountPaise: 99.5 },
      { amountPaise: 0 },
      { amountPaise: 900000, classesPerWeek: 20 },
    ]) {
      expect(feePlanInput.safeParse({ name: "Plan", ...bad }).success, JSON.stringify(bad)).toBe(
        false,
      );
    }
  });
});

describe("batch server functions", () => {
  it("adds the open member count to each batch", async () => {
    const { client } = fakeSupabase((call) => {
      if (call.table === "batches")
        return {
          data: [
            { id: batchId, name: "Hip Hop" },
            { id: "b2", name: "Kathak" },
          ],
        };
      if (call.table === "batch_members")
        return { data: [{ batch_id: batchId }, { batch_id: batchId }] };
      return {};
    });
    const rows = await listBatches(
      { supabase: client, userId: user },
      { includeArchived: false, limit: 100 },
    );
    expect(rows.map((row) => [row.name, row.member_count])).toEqual([
      ["Hip Hop", 2],
      ["Kathak", 0],
    ]);
  });

  it("only counts members who have not left", async () => {
    const { client, calls } = fakeSupabase((call) =>
      call.table === "batches" ? { data: [{ id: batchId }] } : { data: [] },
    );
    await listBatches({ supabase: client, userId: user }, { includeArchived: false, limit: 100 });
    const members = calls.find((call) => call.table === "batch_members");
    expect(stepsOf(members!, "is")).toEqual([
      ["left_on", null],
      ["students.archived_at", null],
    ]);
  });

  it("takes the studio from the signed-in user when creating a batch", async () => {
    const { client, calls } = fakeSupabase((call) =>
      call.table === "batches" ? { data: { id: batchId } } : {},
    );
    await saveBatch(
      { supabase: client, userId: user },
      {
        name: "Hip Hop",
        weekdays: [2],
        startsAt: null,
        endsAt: null,
        trainerName: null,
        room: null,
      },
    );
    const insert = calls.find((call) => call.table === "batches");
    expect(stepsOf(insert!, "insert")[0]![0]).toMatchObject({
      studio_id: user,
      name: "Hip Hop",
      weekdays: [2],
    });
  });

  it("reports a student who is already on the roster in plain words", async () => {
    const { client } = fakeSupabase((call) =>
      call.table === "batch_members" ? { error: { code: "23505", message: "dup" } } : {},
    );
    await expect(
      addToBatch({ supabase: client, userId: user }, { batchId, studentId }),
    ).rejects.toThrow("already on this batch's roster");
  });

  it("sends a join date only when one is given", async () => {
    const { client, calls } = fakeSupabase((call) =>
      call.table === "batch_members" ? { data: { id: "m1" } } : {},
    );
    await addToBatch({ supabase: client, userId: user }, { batchId, studentId });
    await addToBatch(
      { supabase: client, userId: user },
      { batchId, studentId, joinedOn: "2026-10-01" },
    );
    const inserts = calls
      .filter((call) => call.table === "batch_members")
      .map((call) => stepsOf(call, "insert")[0]![0]);
    expect(inserts[0]).not.toHaveProperty("joined_on");
    expect(inserts[1]).toMatchObject({ joined_on: "2026-10-01" });
  });

  it("closes only the open membership, and reports a student who is not on the roster", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: [] }));
    await expect(
      removeFromBatch(
        { supabase: client, userId: user },
        { batchId, studentId, leftOn: "2026-10-10" },
      ),
    ).rejects.toThrow("not on this batch's roster");
    const update = calls.find((call) => call.table === "batch_members");
    expect(stepsOf(update!, "update")).toEqual([[{ left_on: "2026-10-10" }]]);
    expect(stepsOf(update!, "is")).toEqual([["left_on", null]]);
  });

  it("lists the roster on a date with each student's name, sorted", async () => {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "batch_members")
        return {
          data: [
            { student_id: "s2", joined_on: "2026-01-01", left_on: null },
            { student_id: "s1", joined_on: "2026-01-01", left_on: null },
          ],
        };
      if (call.table === "students")
        return {
          data: [
            { id: "s1", name: "Asha" },
            { id: "s2", name: "Zoya" },
          ],
        };
      return {};
    });
    const roster = await getRoster(
      { supabase: client, userId: user },
      { batchId, asOf: "2026-10-13" },
    );
    expect(roster.map((member) => member.student_name)).toEqual(["Asha", "Zoya"]);
    const members = calls.find((call) => call.table === "batch_members");
    expect(stepsOf(members!, "lte")).toEqual([["joined_on", "2026-10-13"]]);
    expect(stepsOf(members!, "or")).toEqual([["left_on.is.null,left_on.gte.2026-10-13"]]);
  });
});

describe("fee plan server functions", () => {
  it("counts the students currently on each plan", async () => {
    const { client } = fakeSupabase((call) => {
      if (call.table === "fee_plans") return { data: [{ id: planId, name: "Eight classes" }] };
      if (call.table === "fee_plan_assignments")
        return {
          data: [{ fee_plan_id: planId }, { fee_plan_id: planId }, { fee_plan_id: planId }],
        };
      return {};
    });
    const [plan] = await listFeePlans(
      { supabase: client, userId: user },
      { includeArchived: false, limit: 100 },
    );
    expect(plan?.students_assigned).toBe(3);
  });

  it("changes a plan's price without touching existing assignments", async () => {
    const { client, calls } = fakeSupabase((call) =>
      call.table === "fee_plans" ? { data: { id: planId } } : {},
    );
    await saveFeePlan(
      { supabase: client, userId: user },
      { id: planId, name: "Eight classes", amountPaise: 1000000, classesPerWeek: 8 },
    );
    expect(calls.every((call) => call.table !== "fee_plan_assignments")).toBe(true);
  });

  it("assigns through the database function with the student, plan and start date", async () => {
    const { client, calls } = fakeSupabase((call) =>
      call.fn === "assign_fee_plan"
        ? { data: "assignment-1" }
        : call.fn === "generate_student_charges"
          ? { data: 2 }
          : {},
    );
    const result = await assignFeePlan(
      { supabase: client, userId: user },
      { studentId, planId, startsOn: "2026-11-01" },
    );
    expect(result).toEqual({ id: "assignment-1", charged: 2 });
    const rpc = calls.find((call) => call.fn === "assign_fee_plan");
    expect(rpc?.args).toEqual([
      { p_student: studentId, p_plan: planId, p_starts_on: "2026-11-01" },
    ]);
    const backfill = calls.find((call) => call.fn === "generate_student_charges");
    expect(backfill?.args).toEqual([{ p_student: studentId, p_from: "2026-11-01" }]);
  });

  it("passes through the readable reason when the database refuses an assignment", async () => {
    const { client } = fakeSupabase((call) =>
      call.fn === "assign_fee_plan"
        ? { error: { code: "P0001", message: "fee plan is archived" } }
        : {},
    );
    await expect(
      assignFeePlan(
        { supabase: client, userId: user },
        { studentId, planId, startsOn: "2026-11-01" },
      ),
    ).rejects.toThrow("fee plan is archived");
  });
});
