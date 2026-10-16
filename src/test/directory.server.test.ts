import { describe, expect, it } from "vitest";
import {
  listGuardians,
  listStudents,
  saveGuardian,
  saveStudent,
  setStudentArchived,
} from "@/lib/directory.server";
import { fakeSupabase, stepsOf } from "./fake-supabase";

const user = "11111111-1111-4111-8111-111111111111";
const guardianId = "22222222-2222-4222-8222-222222222222";

describe("directory server functions", () => {
  it("lists active guardians by default, ordered by name, with the page size applied", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: [] }));
    await listGuardians({ supabase: client, userId: user }, { includeArchived: false, limit: 50 });
    const call = calls[0];
    expect(call.table).toBe("guardians");
    expect(stepsOf(call, "is")).toEqual([["archived_at", null]]);
    expect(stepsOf(call, "order")).toEqual([["name"]]);
    expect(stepsOf(call, "limit")).toEqual([[50]]);
  });

  it("includes archived guardians only when asked, and escapes wildcard characters in the search", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: [] }));
    await listGuardians(
      { supabase: client, userId: user },
      { includeArchived: true, limit: 10, search: "50%_" },
    );
    const call = calls[0];
    expect(stepsOf(call, "is")).toEqual([]);
    expect(stepsOf(call, "ilike")).toEqual([["name", "%50\\%\\_%"]]);
  });

  it("creates a guardian for the signed-in studio and never takes the studio from the input", async () => {
    const { client, calls } = fakeSupabase((call) =>
      call.table === "guardians" ? { data: { id: guardianId, name: "Ritu" } } : {},
    );
    const saved = await saveGuardian(
      { supabase: client, userId: user },
      { name: "Ritu", phone: "+91 98765 43210", remindersOptedOut: false },
    );
    expect(saved).toMatchObject({ id: guardianId });
    const insert = calls.find((call) => call.table === "guardians");
    expect(stepsOf(insert!, "insert")).toEqual([
      [{ studio_id: user, name: "Ritu", phone: "+91 98765 43210", reminders_opted_out: false }],
    ]);
  });

  it("updates an existing guardian by id and reports one that is not visible as not found", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: null }));
    await expect(
      saveGuardian(
        { supabase: client, userId: user },
        { id: guardianId, name: "Ritu", phone: null, remindersOptedOut: true },
      ),
    ).rejects.toThrow("Guardian not found.");
    const update = calls.find((call) => call.table === "guardians");
    expect(stepsOf(update!, "eq")).toEqual([["id", guardianId]]);
  });

  it("attaches each student's guardian name to the list", async () => {
    const { client } = fakeSupabase((call) => {
      if (call.table === "students")
        return {
          data: [
            { id: "s1", name: "Kabir", guardian_id: guardianId },
            { id: "s2", name: "Mira", guardian_id: null },
          ],
        };
      if (call.table === "guardians") return { data: [{ id: guardianId, name: "Meera Shah" }] };
      return {};
    });
    const rows = await listStudents(
      { supabase: client, userId: user },
      { includeArchived: false, limit: 100 },
    );
    expect(rows.map((row) => [row.name, row.guardian_name])).toEqual([
      ["Kabir", "Meera Shah"],
      ["Mira", null],
    ]);
  });

  it("filters students by guardian and skips the guardian lookup when none are linked", async () => {
    const { client, calls } = fakeSupabase(() => ({
      data: [{ id: "s2", name: "Mira", guardian_id: null }],
    }));
    await listStudents(
      { supabase: client, userId: user },
      { includeArchived: false, limit: 100, guardianId },
    );
    expect(stepsOf(calls[0], "eq")).toEqual([["guardian_id", guardianId]]);
    expect(calls).toHaveLength(1);
  });

  it("archives a student by stamping a time and restores one by clearing it", async () => {
    const { client, calls } = fakeSupabase((call) =>
      call.table === "students" ? { data: { id: "s1" } } : {},
    );
    await setStudentArchived({ supabase: client, userId: user }, { id: "s1", archived: true });
    await setStudentArchived({ supabase: client, userId: user }, { id: "s1", archived: false });
    const updates = calls
      .filter((call) => call.table === "students")
      .map(
        (call) => (stepsOf(call, "update")[0]![0] as { archived_at: string | null }).archived_at,
      );
    expect(updates[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(updates[1]).toBeNull();
  });

  it("turns a database failure into a readable message", async () => {
    const { client } = fakeSupabase((call) =>
      call.table === "students"
        ? {
            error: {
              code: "23503",
              message: "violates foreign key constraint students_guardian_fk",
            },
          }
        : {},
    );
    const failure = saveStudent({ supabase: client, userId: user }, { name: "Cross", guardianId });
    await expect(failure).rejects.toThrow("another studio");
    await expect(failure).rejects.not.toThrow(/students_guardian_fk/);
  });
});
