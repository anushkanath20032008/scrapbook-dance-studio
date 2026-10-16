// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newBatch, newStudent, newStudio } from "./fixtures";

describe("attendance: sessions and marks", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const session = async (owner: string, batch: string, date: string) =>
    (
      await db.query<{ id: string }>(
        { user: owner },
        "INSERT INTO public.class_sessions (studio_id, batch_id, session_on) VALUES ($1, $2, $3::date) ON CONFLICT (batch_id, session_on) DO UPDATE SET session_on = EXCLUDED.session_on RETURNING id",
        [owner, batch, date],
      )
    )[0].id;

  const mark = (owner: string, sessionId: string, studentId: string, present: boolean) =>
    db.query(
      { user: owner },
      "INSERT INTO public.attendance_records (studio_id, session_id, student_id, present) VALUES ($1, $2, $3, $4) ON CONFLICT (session_id, student_id) DO UPDATE SET present = EXCLUDED.present, marked_at = now()",
      [owner, sessionId, studentId, present],
    );

  it("keeps one session per batch and date and one mark per student, replacing an earlier mark", async () => {
    const owner = await newStudio(db);
    const batch = await newBatch(db, owner);
    const s = await newStudent(db, owner, "Kabir");
    const first = await session(owner, batch, "2026-10-13");
    const again = await session(owner, batch, "2026-10-13");
    expect(again).toBe(first);
    await mark(owner, first, s.id, true);
    await mark(owner, first, s.id, false);
    const rows = await db.query<{ present: boolean }>({ user: owner }, "SELECT present FROM public.attendance_records WHERE session_id = $1", [first]);
    expect(rows).toEqual([{ present: false }]);
  });

  it("rejects a mark for another studio's student or batch, even for the service role", async () => {
    const owner = await newStudio(db);
    const other = await newStudio(db);
    const batch = await newBatch(db, owner);
    const theirs = await newStudent(db, other, "Theirs");
    const sessionId = await session(owner, batch, "2026-10-13");
    expect(
      await rejection(db.query("service", "INSERT INTO public.attendance_records (studio_id, session_id, student_id, present) VALUES ($1, $2, $3, true)", [owner, sessionId, theirs.id])),
    ).toMatch(/foreign key/i);
    const theirBatch = await newBatch(db, other);
    expect(
      await rejection(db.query("service", "INSERT INTO public.class_sessions (studio_id, batch_id, session_on) VALUES ($1, $2, DATE '2026-10-13')", [owner, theirBatch])),
    ).toMatch(/foreign key/i);
  });

  it("hides sessions and marks from other studios and anonymous callers", async () => {
    const owner = await newStudio(db);
    const other = await newStudio(db);
    const batch = await newBatch(db, owner);
    const s = await newStudent(db, owner, "Mira");
    const sessionId = await session(owner, batch, "2026-10-14");
    await mark(owner, sessionId, s.id, true);
    for (const table of ["class_sessions", "attendance_records"]) {
      expect(await db.query({ user: other }, `SELECT 1 FROM public.${table}`)).toEqual([]);
      expect(await db.query("anon", `SELECT 1 FROM public.${table}`).catch(() => [])).toEqual([]);
    }
  });

  it("does not let owners delete sessions or marks", async () => {
    const owner = await newStudio(db);
    const batch = await newBatch(db, owner);
    const sessionId = await session(owner, batch, "2026-10-15");
    expect(await rejection(db.query({ user: owner }, "DELETE FROM public.class_sessions WHERE id = $1", [sessionId]))).toMatch(/permission denied/i);
  });
});
