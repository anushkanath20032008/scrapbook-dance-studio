// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newBatch, newStudent, newStudio } from "./fixtures";

describe("attendance summaries", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  async function roster(owner: string, batch: string, student: string) {
    await db.admin(
      "INSERT INTO public.batch_members (studio_id, batch_id, student_id, joined_on) VALUES ($1, $2, $3, '2026-01-01')",
      [owner, batch, student],
    );
  }
  const mark = (owner: string, batch: string, date: string, marks: [string, boolean][]) =>
    db.query({ user: owner }, "SELECT public.mark_attendance($1, $2::date, $3::jsonb)", [
      batch,
      date,
      JSON.stringify(marks.map(([student_id, present]) => ({ student_id, present }))),
    ]);
  const byStudent = (owner: string, from = "2026-10-01", to = "2026-10-31") =>
    db.query<{ student_name: string; marked: number; present: number }>(
      { user: owner },
      "SELECT student_name, marked, present FROM public.attendance_by_student($1::date, $2::date)",
      [from, to],
    );
  const byBatch = (owner: string, from = "2026-10-01", to = "2026-10-31") =>
    db.query<{ batch_name: string; weekdays: number[]; held: number }>(
      { user: owner },
      "SELECT batch_name, weekdays, held FROM public.attendance_by_batch($1::date, $2::date)",
      [from, to],
    );

  it("counts marks per dancer in the range and gives a dancer with no marks zero, not a missing row", async () => {
    const owner = await newStudio(db);
    const batch = await newBatch(db, owner, "Hip Hop");
    const asha = await newStudent(db, owner, "Asha");
    const ben = await newStudent(db, owner, "Ben");
    await newStudent(db, owner, "Cara");
    await roster(owner, batch, asha.id);
    await roster(owner, batch, ben.id);
    await mark(owner, batch, "2026-10-06", [
      [asha.id, true],
      [ben.id, false],
    ]);
    await mark(owner, batch, "2026-10-08", [
      [asha.id, true],
      [ben.id, true],
    ]);
    await mark(owner, batch, "2026-10-13", [[asha.id, false]]);
    expect(await byStudent(owner)).toEqual([
      { student_name: "Asha", marked: 3, present: 2 },
      { student_name: "Ben", marked: 2, present: 1 },
      { student_name: "Cara", marked: 0, present: 0 },
    ]);
  });

  it("only counts sessions inside the range and ignores archived dancers", async () => {
    const owner = await newStudio(db);
    const batch = await newBatch(db, owner, "Jazz");
    const asha = await newStudent(db, owner, "Asha");
    const gone = await newStudent(db, owner, "Gone");
    await roster(owner, batch, asha.id);
    await roster(owner, batch, gone.id);
    await mark(owner, batch, "2026-09-29", [[asha.id, true]]);
    await mark(owner, batch, "2026-10-02", [
      [asha.id, true],
      [gone.id, true],
    ]);
    await db.admin("UPDATE public.students SET archived_at = now() WHERE id = $1", [gone.id]);
    expect(await byStudent(owner)).toEqual([{ student_name: "Asha", marked: 1, present: 1 }]);
    expect(await byStudent(owner, "2026-09-01", "2026-09-30")).toEqual([
      { student_name: "Asha", marked: 1, present: 1 },
    ]);
  });

  it("counts classes held per running batch, once per date however many dancers were marked", async () => {
    const owner = await newStudio(db);
    const running = await newBatch(db, owner, "Running");
    const quiet = await newBatch(db, owner, "Quiet");
    const retired = await newBatch(db, owner, "Retired");
    await db.admin("UPDATE public.batches SET weekdays = '{2,4}' WHERE id = $1", [running]);
    await db.admin("UPDATE public.batches SET archived_at = now() WHERE id = $1", [retired]);
    const asha = await newStudent(db, owner, "Asha");
    const ben = await newStudent(db, owner, "Ben");
    await roster(owner, running, asha.id);
    await roster(owner, running, ben.id);
    await mark(owner, running, "2026-10-06", [
      [asha.id, true],
      [ben.id, true],
    ]);
    await mark(owner, running, "2026-10-08", [[asha.id, true]]);
    void quiet;
    const rows = await byBatch(owner);
    expect(rows.map((r) => [r.batch_name, r.held])).toEqual([
      ["Quiet", 0],
      ["Running", 2],
    ]);
    expect(rows.find((r) => r.batch_name === "Running")?.weekdays).toEqual([2, 4]);
  });

  it("never shows another studio's dancers or batches", async () => {
    const mine = await newStudio(db);
    const theirs = await newStudio(db);
    await newBatch(db, theirs, "Theirs");
    await newStudent(db, theirs, "Stranger");
    expect(await byStudent(mine)).toEqual([]);
    expect(await byBatch(mine)).toEqual([]);
  });

  it("is not available to anonymous callers", async () => {
    expect(
      await rejection(
        db.query(
          "anon",
          "SELECT * FROM public.attendance_by_student('2026-10-01'::date, '2026-10-31'::date)",
        ),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await rejection(
        db.query(
          "anon",
          "SELECT * FROM public.attendance_by_batch('2026-10-01'::date, '2026-10-31'::date)",
        ),
      ),
    ).toMatch(/permission denied/i);
  });
});
