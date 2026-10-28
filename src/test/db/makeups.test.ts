// @vitest-environment node
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newBatch, newStudent, newStudio } from "./fixtures";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const TOKEN = (n: number) => `mk${String(n).padStart(2, "0")}`.padEnd(43, "t");
const CODE = (n: number) => `WXYZ${String(2000 + n)}`;

type MakeupRow = {
  id: string;
  student_name: string;
  missed_batch_name: string;
  missed_on: string;
  makeup_batch_name: string;
  makeup_on: string;
  done_at: string | null;
};

describe("make-up classes", () => {
  let db: TestDb;
  let counter = 0;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  async function addInstructor(owner: string) {
    const n = ++counter;
    const user = await db.addUser(`makeup-teacher-${n}@example.com`);
    await db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite(NULL, 7, $1, $2)", [sha(TOKEN(n)), sha(CODE(n))]);
    await db.query({ user }, "SELECT public.redeem_instructor_invite($1)", [TOKEN(n)]);
    return user;
  }

  /** A studio with three dancers on a batch; two are marked absent on 2026-10-09, one present. */
  async function studioWithAbsences() {
    const owner = await newStudio(db, "Natya");
    const batch = await newBatch(db, owner, "Beginners");
    const other = await newBatch(db, owner, "Friday");
    const asha = await newStudent(db, owner, "Asha", { amountPaise: 150000 });
    const ravi = await newStudent(db, owner, "Ravi");
    const meera = await newStudent(db, owner, "Meera");
    for (const s of [asha, ravi, meera]) {
      await db.admin("INSERT INTO public.batch_members (studio_id, batch_id, student_id, joined_on) VALUES ($1, $2, $3, DATE '2026-01-01')", [owner, batch, s.id]);
    }
    const marks = JSON.stringify([
      { student_id: asha.id, present: false },
      { student_id: ravi.id, present: false },
      { student_id: meera.id, present: true },
    ]);
    await db.query({ user: owner }, "SELECT public.mark_attendance($1, DATE '2026-10-09', $2::jsonb)", [batch, marks]);
    return { owner, batch, other, asha, ravi, meera };
  }

  const plan = (user: string, batch: string, students: string[], makeupBatch: string, on: string, missedOn = "2026-10-09") =>
    db.query<{ n: number }>({ user }, "SELECT public.plan_makeup($1, $2::date, $3::uuid[], $4, $5::date) AS n", [batch, missedOn, students, makeupBatch, on]);

  const counts = async (owner: string) => {
    const [row] = await db.admin<{ c: string; a: string; r: string }>(
      `SELECT (SELECT count(*) FROM public.charges WHERE studio_id = $1)::text AS c,
              (SELECT count(*) FROM public.fee_plan_assignments WHERE studio_id = $1)::text AS a,
              (SELECT count(*) FROM public.reminders WHERE studio_id = $1)::text AS r`,
      [owner],
    );
    return row;
  };

  const makeupCount = async (...studios: string[]) =>
    (await db.admin<{ n: string }>("SELECT count(*)::text AS n FROM public.makeup_classes WHERE studio_id = ANY($1::uuid[])", [studios]))[0].n;

  it("lets a teacher plan a make-up for two absent dancers, listed with names and the date and no contact fields", async () => {
    const { owner, batch, other, asha, ravi } = await studioWithAbsences();
    const teacher = await addInstructor(owner);
    expect((await plan(teacher, batch, [asha.id, ravi.id], other, "2026-10-16"))[0].n).toBe(2);

    const rows = await db.query<MakeupRow>({ user: teacher }, "SELECT * FROM public.list_makeups()");
    expect(rows.map((r) => [r.student_name, r.missed_batch_name, r.makeup_batch_name, new Date(r.makeup_on).toISOString().slice(0, 10), r.done_at])).toEqual([
      ["Asha", "Beginners", "Friday", "2026-10-16", null],
      ["Ravi", "Beginners", "Friday", "2026-10-16", null],
    ]);
    expect(Object.keys(rows[0]).join(",")).not.toMatch(/phone|fee|amount|guardian|payment/);
    // The owner sees the same rows.
    expect((await db.query({ user: owner }, "SELECT * FROM public.list_makeups()")).length).toBe(2);
  });

  it("leaves fees, charges and reminders untouched", async () => {
    const { owner, batch, other, asha } = await studioWithAbsences();
    const before = await counts(owner);
    await plan(owner, batch, [asha.id], other, "2026-10-16");
    expect(await counts(owner)).toEqual(before);
  });

  it("refuses a teacher planning for another studio's dancer or batch, and writes nothing", async () => {
    const mine = await studioWithAbsences();
    const theirs = await studioWithAbsences();
    const teacher = await addInstructor(mine.owner);
    expect(await rejection(plan(teacher, theirs.batch, [theirs.asha.id], theirs.other, "2026-10-16"))).toMatch(/batch not found/);
    expect(await rejection(plan(teacher, mine.batch, [theirs.asha.id], mine.other, "2026-10-16"))).toMatch(/not marked absent/);
    expect(await rejection(plan(teacher, mine.batch, [mine.asha.id], theirs.other, "2026-10-16"))).toMatch(/batch not found/);
    expect(await makeupCount(theirs.owner, mine.owner)).toBe("0");
  });

  it("refuses a teacher on the table and on every money table", async () => {
    const { owner } = await studioWithAbsences();
    const teacher = await addInstructor(owner);
    // The new table has no grant at all; the money tables either refuse or show a teacher no row.
    expect(await rejection(db.query({ user: teacher }, "SELECT * FROM public.makeup_classes"))).toMatch(/permission denied/i);
    for (const table of ["fee_plan_assignments", "charges", "payments", "guardians"]) {
      let seen: number;
      try {
        seen = (await db.query({ user: teacher }, `SELECT * FROM public.${table}`)).length;
      } catch (error) {
        expect(String(error), table).toMatch(/permission denied/i);
        seen = 0;
      }
      expect(seen, table).toBe(0);
    }
    // The owner has no direct access to the table either: only the functions.
    expect(await rejection(db.query({ user: owner }, "SELECT * FROM public.makeup_classes"))).toMatch(/permission denied/i);
    expect(await rejection(db.query("anon", "SELECT * FROM public.list_makeups()"))).toMatch(/permission denied/i);
  });

  it("refuses dancers who were present or not marked, naming the dancer", async () => {
    const { owner, batch, other, meera } = await studioWithAbsences();
    expect(await rejection(plan(owner, batch, [meera.id], other, "2026-10-16"))).toMatch(/Meera/);
    const unmarked = await newStudent(db, owner, "Kavya");
    await db.admin("INSERT INTO public.batch_members (studio_id, batch_id, student_id, joined_on) VALUES ($1, $2, $3, DATE '2026-01-01')", [owner, batch, unmarked.id]);
    expect(await rejection(plan(owner, batch, [unmarked.id], other, "2026-10-16"))).toMatch(/Kavya/);
    expect(await rejection(plan(owner, batch, [], other, "2026-10-16"))).toMatch(/at least one/);
    expect(await makeupCount(owner)).toBe("0");
  });

  it("keeps one row per dancer and missed class: planning again moves it and reopens it", async () => {
    const { owner, batch, other, asha } = await studioWithAbsences();
    await plan(owner, batch, [asha.id], other, "2026-10-16");
    const [{ id }] = await db.query<MakeupRow>({ user: owner }, "SELECT * FROM public.list_makeups()");
    await db.query({ user: owner }, "SELECT public.finish_makeup($1)", [id]);
    await plan(owner, batch, [asha.id], batch, "2026-10-23");
    const rows = await db.query<MakeupRow>({ user: owner }, "SELECT * FROM public.list_makeups()");
    expect(rows).toHaveLength(1);
    expect(new Date(rows[0].makeup_on).toISOString().slice(0, 10)).toBe("2026-10-23");
    expect(rows[0].makeup_batch_name).toBe("Beginners");
    expect(rows[0].done_at).toBeNull();
  });

  it("finishes a make-up, harmlessly twice, and not for another studio", async () => {
    const { owner, batch, other, asha } = await studioWithAbsences();
    const outsider = await studioWithAbsences();
    const teacher = await addInstructor(owner);
    await plan(teacher, batch, [asha.id], other, "2026-10-16");
    const [{ id }] = await db.query<MakeupRow>({ user: teacher }, "SELECT * FROM public.list_makeups()");
    const stranger = await addInstructor(outsider.owner);
    expect(await rejection(db.query({ user: stranger }, "SELECT public.finish_makeup($1)", [id]))).toMatch(/not found/);
    expect(await rejection(db.query({ user: outsider.owner }, "SELECT public.finish_makeup($1)", [id]))).toMatch(/not found/);

    await db.query({ user: teacher }, "SELECT public.finish_makeup($1)", [id]);
    const [first] = await db.admin<{ done_at: string }>("SELECT done_at FROM public.makeup_classes WHERE id = $1", [id]);
    expect(first.done_at).not.toBeNull();
    await db.query({ user: owner }, "SELECT public.finish_makeup($1)", [id]);
    const [second] = await db.admin<{ done_at: string }>("SELECT done_at FROM public.makeup_classes WHERE id = $1", [id]);
    expect(second.done_at).toEqual(first.done_at);
  });

  it("refuses a make-up date before the missed date", async () => {
    const { owner, batch, other, asha } = await studioWithAbsences();
    expect(await rejection(plan(owner, batch, [asha.id], other, "2026-10-08"))).toMatch(/before/);
    expect(await makeupCount(owner)).toBe("0");
  });

  it("stops a removed teacher from planning, listing or finishing", async () => {
    const { owner, batch, other, asha } = await studioWithAbsences();
    const teacher = await addInstructor(owner);
    await plan(owner, batch, [asha.id], other, "2026-10-16");
    const [{ id }] = await db.query<MakeupRow>({ user: owner }, "SELECT * FROM public.list_makeups()");
    await db.query({ user: owner }, "UPDATE public.studio_instructors SET revoked_at = now()");
    expect(await db.query({ user: teacher }, "SELECT * FROM public.list_makeups()")).toEqual([]);
    expect(await rejection(plan(teacher, batch, [asha.id], other, "2026-10-17"))).toMatch(/access/);
    expect(await rejection(db.query({ user: teacher }, "SELECT public.finish_makeup($1)", [id]))).toMatch(/access|not found/);
  });

  it("gives a user with no studio nothing", async () => {
    const stranger = await db.addUser();
    expect(await db.query({ user: stranger }, "SELECT * FROM public.list_makeups()")).toEqual([]);
  });
});
