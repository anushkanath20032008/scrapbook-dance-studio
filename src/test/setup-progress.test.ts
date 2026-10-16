import { describe, expect, it } from "vitest";
import { buildSetupSteps, setupProgress, type SetupCounts } from "@/lib/setup-progress";
import { getSetupCounts, listStudentOverview } from "@/lib/setup.server";
import { fakeSupabase, stepsOf } from "./fake-supabase";

const empty: SetupCounts = {
  feePlans: 0,
  batches: 0,
  students: 0,
  studentsWithContact: 0,
  studentsOnBatch: 0,
  studentsWithPlan: 0,
};
const done = (counts: SetupCounts) => buildSetupSteps(counts).map((step) => step.done);

describe("setup checklist", () => {
  it("starts with nothing done", () => {
    expect(done(empty)).toEqual([false, false, false, false, false]);
    expect(setupProgress(buildSetupSteps(empty))).toEqual({ done: 0, total: 5, complete: false });
  });

  it("ticks each step only when its own rows exist", () => {
    expect(done({ ...empty, feePlans: 2 })).toEqual([true, false, false, false, false]);
    expect(done({ ...empty, batches: 1 })).toEqual([false, true, false, false, false]);
    expect(done({ ...empty, students: 3 })).toEqual([false, false, false, false, false]);
    expect(done({ ...empty, students: 3, studentsWithContact: 2 })[2]).toBe(true);
    expect(done({ ...empty, studentsOnBatch: 1 })[3]).toBe(true);
  });

  it("needs every student on a plan before the last step is done", () => {
    const base = { ...empty, students: 5, studentsWithContact: 5 };
    expect(done({ ...base, studentsWithPlan: 4 })[4]).toBe(false);
    expect(done({ ...base, studentsWithPlan: 5 })[4]).toBe(true);
    expect(done({ ...empty, studentsWithPlan: 0 })[4]).toBe(false);
  });

  it("is complete when all five steps are done", () => {
    const all = {
      feePlans: 2,
      batches: 2,
      students: 5,
      studentsWithContact: 5,
      studentsOnBatch: 5,
      studentsWithPlan: 5,
    };
    expect(setupProgress(buildSetupSteps(all)).complete).toBe(true);
  });
});

const user = "11111111-1111-4111-8111-111111111111";
const ids = (...values: string[]) => values.map((id) => ({ id }));

describe("getSetupCounts", () => {
  it("counts only active records, and a student on an archived batch is not on a batch", async () => {
    const { client, calls } = fakeSupabase((call) => {
      switch (call.table) {
        case "fee_plans":
          return { data: ids("p1") };
        case "batches":
          return { data: ids("b1") };
        case "students":
          return {
            data: [
              { id: "s1", guardian_id: "g1" },
              { id: "s2", guardian_id: "g2" },
              { id: "s3", guardian_id: null },
            ],
          };
        case "guardians":
          return { data: ids("g1") };
        case "batch_members":
          return {
            data: [
              { student_id: "s1", batch_id: "b1" },
              { student_id: "s2", batch_id: "archived-batch" },
            ],
          };
        case "fee_plan_assignments":
          return { data: [{ student_id: "s1" }, { student_id: "gone" }] };
        default:
          return {};
      }
    });
    const counts = await getSetupCounts({ supabase: client, userId: user });
    expect(counts).toEqual({
      feePlans: 1,
      batches: 1,
      students: 3,
      studentsWithContact: 1,
      studentsOnBatch: 1,
      studentsWithPlan: 1,
    });
    // Archived records are filtered out in the query itself.
    for (const table of ["fee_plans", "batches", "students", "guardians"]) {
      const call = calls.find((c) => c.table === table && stepsOf(c, "select").length > 0);
      expect(stepsOf(call!, "is")).toContainEqual(["archived_at", null]);
    }
  });

  it("reports an archived-only studio as empty", async () => {
    const { client } = fakeSupabase(() => ({ data: [] }));
    expect(await getSetupCounts({ supabase: client, userId: user })).toEqual(empty);
  });
});

describe("listStudentOverview", () => {
  it("joins each student with guardian, open batches and current plan", async () => {
    const { client } = fakeSupabase((call) => {
      switch (call.table) {
        case "students":
          return {
            data: [
              { id: "s1", name: "Asha", guardian_id: "g1", archived_at: null },
              { id: "s2", name: "Ben", guardian_id: null, archived_at: null },
            ],
          };
        case "guardians":
          return { data: [{ id: "g1", name: "Mira", phone: "9876543210" }] };
        case "batch_members":
          return { data: [{ student_id: "s1", batch_id: "b1" }] };
        case "batches":
          return { data: [{ id: "b1", name: "Hip Hop" }] };
        case "fee_plan_assignments":
          return {
            data: [
              {
                student_id: "s1",
                fee_plan_id: "p1",
                amount_paise: 150000,
                starts_on: "2026-10-01",
              },
            ],
          };
        case "fee_plans":
          return { data: [{ id: "p1", name: "Monthly" }] };
        default:
          return {};
      }
    });
    const rows = await listStudentOverview(
      { supabase: client, userId: user },
      { includeArchived: false, limit: 100 },
    );
    expect(rows).toEqual([
      {
        id: "s1",
        name: "Asha",
        archived_at: null,
        guardian: { id: "g1", name: "Mira", phone: "9876543210" },
        batches: [{ id: "b1", name: "Hip Hop" }],
        plan: { id: "p1", name: "Monthly", amount_paise: 150000, starts_on: "2026-10-01" },
      },
      { id: "s2", name: "Ben", archived_at: null, guardian: null, batches: [], plan: null },
    ]);
  });

  it("returns nothing for an empty studio without further queries", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: [] }));
    const rows = await listStudentOverview(
      { supabase: client, userId: user },
      { includeArchived: false, limit: 100 },
    );
    expect(rows).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});
