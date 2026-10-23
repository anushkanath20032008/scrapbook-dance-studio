import { describe, expect, it } from "vitest";
import {
  buildSetupSteps,
  nextSetupStep,
  setupProgress,
  type SetupCounts,
} from "@/lib/setup-progress";
import { getSetupCounts, listStudentOverview } from "@/lib/setup.server";
import { fakeSupabase, stepsOf } from "./fake-supabase";

const empty: SetupCounts = {
  feePlans: 0,
  batches: 0,
  students: 0,
  studentsWithContact: 0,
  studentsOnBatch: 0,
  studentsWithPlan: 0,
  chargesThisMonth: 0,
};
// students, fees, charges, batches, roster
const done = (counts: SetupCounts) => buildSetupSteps(counts).map((step) => step.done);

describe("setup checklist", () => {
  it("starts with nothing done, and only three steps are required", () => {
    expect(done(empty)).toEqual([false, false, false, false, false]);
    expect(setupProgress(buildSetupSteps(empty))).toEqual({ done: 0, total: 3, complete: false });
    expect(buildSetupSteps(empty).filter((step) => step.optional).map((step) => step.id)).toEqual([
      "batches",
      "roster",
    ]);
  });

  it("ticks each step only when its own rows exist", () => {
    expect(done({ ...empty, batches: 1 })).toEqual([false, false, false, true, false]);
    expect(done({ ...empty, students: 3 })[0]).toBe(false);
    expect(done({ ...empty, students: 3, studentsWithContact: 2 })[0]).toBe(true);
    expect(done({ ...empty, studentsOnBatch: 1 })[4]).toBe(true);
    expect(done({ ...empty, chargesThisMonth: 4 })[2]).toBe(true);
  });

  it("needs every student on a plan before the fee step is done", () => {
    const base = { ...empty, students: 5, studentsWithContact: 5 };
    expect(done({ ...base, studentsWithPlan: 4 })[1]).toBe(false);
    expect(done({ ...base, studentsWithPlan: 5 })[1]).toBe(true);
    expect(done({ ...empty, studentsWithPlan: 0 })[1]).toBe(false);
  });

  it("is complete once the three required steps are done, without batches", () => {
    const ready = {
      ...empty,
      students: 5,
      studentsWithContact: 5,
      studentsWithPlan: 5,
      chargesThisMonth: 5,
    };
    expect(setupProgress(buildSetupSteps(ready))).toEqual({ done: 3, total: 3, complete: true });
    expect(nextSetupStep(buildSetupSteps(ready))).toBeNull();
  });

  it("points at the first required step still to do", () => {
    expect(nextSetupStep(buildSetupSteps(empty))?.id).toBe("students");
    const dancers = { ...empty, students: 2, studentsWithContact: 2 };
    expect(nextSetupStep(buildSetupSteps(dancers))?.id).toBe("fees");
    expect(nextSetupStep(buildSetupSteps({ ...dancers, studentsWithPlan: 2 }))?.id).toBe("charges");
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
        case "charges":
          return { data: [{ student_id: "s1" }, { student_id: "s1" }, { student_id: "gone" }] };
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
      chargesThisMonth: 1,
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
