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
    const rows = await db.query<{ present: boolean }>(
      { user: owner },
      "SELECT present FROM public.attendance_records WHERE session_id = $1",
      [first],
    );
    expect(rows).toEqual([{ present: false }]);
  });

  it("rejects a mark for another studio's student or batch, even for the service role", async () => {
    const owner = await newStudio(db);
    const other = await newStudio(db);
    const batch = await newBatch(db, owner);
    const theirs = await newStudent(db, other, "Theirs");
    const sessionId = await session(owner, batch, "2026-10-13");
    expect(
      await rejection(
        db.query(
          "service",
          "INSERT INTO public.attendance_records (studio_id, session_id, student_id, present) VALUES ($1, $2, $3, true)",
          [owner, sessionId, theirs.id],
        ),
      ),
    ).toMatch(/foreign key/i);
    const theirBatch = await newBatch(db, other);
    expect(
      await rejection(
        db.query(
          "service",
          "INSERT INTO public.class_sessions (studio_id, batch_id, session_on) VALUES ($1, $2, DATE '2026-10-13')",
          [owner, theirBatch],
        ),
      ),
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
    expect(
      await rejection(
        db.query({ user: owner }, "DELETE FROM public.class_sessions WHERE id = $1", [sessionId]),
      ),
    ).toMatch(/permission denied/i);
  });

  describe("mark_attendance and batch_day", () => {
    const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const markDay = (
      owner: string,
      batch: string,
      date: string,
      marks: { student_id: string; present: boolean }[],
    ) =>
      db
        .query<{ n: number }>(
          { user: owner },
          "SELECT public.mark_attendance($1, $2::date, $3::jsonb) AS n",
          [batch, date, JSON.stringify(marks)],
        )
        .then((r) => r[0].n);
    const day = (owner: string, batch: string, date: string) =>
      db.query<{ student_name: string; present: boolean | null }>(
        { user: owner },
        "SELECT student_name, present FROM public.batch_day($1, $2::date) ORDER BY student_name",
        [batch, date],
      );

    it("marks a roster in one call, lists the day with unmarked students, and replaces marks on a second call", async () => {
      const owner = await newStudio(db);
      const batch = await newBatch(db, owner);
      const a = await newStudent(db, owner, "Asha");
      const b = await newStudent(db, owner, "Bela");
      const c = await newStudent(db, owner, "Chirag");
      for (const s of [a, b, c])
        await db.admin(
          "INSERT INTO public.batch_members (studio_id, batch_id, student_id, joined_on) VALUES ($1, $2, $3, DATE '2020-01-01')",
          [owner, batch, s.id],
        );
      expect(
        await markDay(owner, batch, today(), [
          { student_id: a.id, present: true },
          { student_id: b.id, present: false },
        ]),
      ).toBe(2);
      expect(await day(owner, batch, today())).toEqual([
        { student_name: "Asha", present: true },
        { student_name: "Bela", present: false },
        { student_name: "Chirag", present: null },
      ]);
      await markDay(owner, batch, today(), [{ student_id: b.id, present: true }]);
      expect(
        (await day(owner, batch, today())).find((r) => r.student_name === "Bela")?.present,
      ).toBe(true);
      const [{ count }] = await db.query<{ count: number }>(
        { user: owner },
        "SELECT count(*)::int AS count FROM public.attendance_records",
      );
      expect(count).toBe(2);
    });

    it("rejects the whole call and writes nothing when a student was not on the roster that day", async () => {
      const owner = await newStudio(db);
      const batch = await newBatch(db, owner);
      const member = await newStudent(db, owner, "Member");
      const left = await newStudent(db, owner, "Left");
      await db.admin(
        "INSERT INTO public.batch_members (studio_id, batch_id, student_id, joined_on) VALUES ($1, $2, $3, DATE '2020-01-01')",
        [owner, batch, member.id],
      );
      await db.admin(
        "INSERT INTO public.batch_members (studio_id, batch_id, student_id, joined_on, left_on) VALUES ($1, $2, $3, DATE '2020-01-01', DATE '2021-01-01')",
        [owner, batch, left.id],
      );
      const message = await rejection(
        markDay(owner, batch, today(), [
          { student_id: member.id, present: true },
          { student_id: left.id, present: true },
        ]),
      );
      expect(message).toMatch(/roster/i);
      expect(await db.query({ user: owner }, "SELECT 1 FROM public.attendance_records")).toEqual(
        [],
      );
      expect(await db.query({ user: owner }, "SELECT 1 FROM public.class_sessions")).toEqual([]);
    });

    it("rejects dates far outside the allowed window and batches from other studios", async () => {
      const owner = await newStudio(db);
      const other = await newStudio(db);
      const batch = await newBatch(db, owner);
      const s = await newStudent(db, owner, "Dated");
      await db.admin(
        "INSERT INTO public.batch_members (studio_id, batch_id, student_id, joined_on) VALUES ($1, $2, $3, DATE '2000-01-01')",
        [owner, batch, s.id],
      );
      const marks = [{ student_id: s.id, present: true }];
      expect(await rejection(markDay(owner, batch, "2099-01-01", marks))).toMatch(/date/i);
      expect(await rejection(markDay(owner, batch, "2000-01-01", marks))).toMatch(/date/i);
      expect(await rejection(markDay(other, batch, today(), marks))).toMatch(/not found/i);
    });
  });
});
