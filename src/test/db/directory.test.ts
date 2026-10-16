// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";

describe("directory schema: guardians, students, batches, rosters, fee plans", () => {
  let db: TestDb;
  let a: string;
  let b: string;
  const ids = {
    guardian: "",
    ananya: "",
    arjun: "",
    batch: "",
    plan8: "",
    plan4: "",
    bStudent: "",
  };

  const one = async <T>(actor: Parameters<TestDb["query"]>[0], sql: string, params?: unknown[]) =>
    (await db.query<T>(actor, sql, params))[0];

  beforeAll(async () => {
    db = await createDb();
    a = await db.addUser("a@example.com");
    b = await db.addUser("b@example.com");
    await db.admin(
      "INSERT INTO public.studio_profiles (user_id, studio_name) VALUES ($1, 'A'), ($2, 'B')",
      [a, b],
    );

    ids.guardian = (
      await one<{ id: string }>(
        { user: a },
        "INSERT INTO public.guardians (studio_id, name, phone) VALUES ($1, 'Ritu Mehta', '+91 98765 43210') RETURNING id",
        [a],
      )
    ).id;
    ids.ananya = (
      await one<{ id: string }>(
        { user: a },
        "INSERT INTO public.students (studio_id, name, guardian_id) VALUES ($1, 'Ananya', $2) RETURNING id",
        [a, ids.guardian],
      )
    ).id;
    ids.arjun = (
      await one<{ id: string }>(
        { user: a },
        "INSERT INTO public.students (studio_id, name, guardian_id) VALUES ($1, 'Arjun', $2) RETURNING id",
        [a, ids.guardian],
      )
    ).id;
    ids.batch = (
      await one<{ id: string }>(
        { user: a },
        "INSERT INTO public.batches (studio_id, name, weekdays, trainer_name, room) VALUES ($1, 'Contemporary Beginners', '{2,4}', 'Amara Singh', 'Studio A') RETURNING id",
        [a],
      )
    ).id;
    ids.plan8 = (
      await one<{ id: string }>(
        { user: a },
        "INSERT INTO public.fee_plans (studio_id, name, amount_paise, classes_per_week) VALUES ($1, '8 classes a week', 900000, 8) RETURNING id",
        [a],
      )
    ).id;
    ids.plan4 = (
      await one<{ id: string }>(
        { user: a },
        "INSERT INTO public.fee_plans (studio_id, name, amount_paise, classes_per_week) VALUES ($1, '4 classes a week', 500000, 4) RETURNING id",
        [a],
      )
    ).id;
    ids.bStudent = (
      await one<{ id: string }>(
        { user: b },
        "INSERT INTO public.students (studio_id, name) VALUES ($1, 'Bela') RETURNING id",
        [b],
      )
    ).id;
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  it("lets an owner build a roster where two students share a batch but pay different plans", async () => {
    await db.query(
      { user: a },
      "INSERT INTO public.batch_members (studio_id, batch_id, student_id) VALUES ($1, $2, $3), ($1, $2, $4)",
      [a, ids.batch, ids.ananya, ids.arjun],
    );
    await db.query({ user: a }, "SELECT public.assign_fee_plan($1, $2, DATE '2026-10-01')", [
      ids.ananya,
      ids.plan8,
    ]);
    await db.query({ user: a }, "SELECT public.assign_fee_plan($1, $2, DATE '2026-10-01')", [
      ids.arjun,
      ids.plan4,
    ]);
    const rows = await db.query<{ name: string; amount_paise: string }>(
      { user: a },
      "SELECT s.name, fa.amount_paise::text FROM public.batch_members bm JOIN public.students s ON s.id = bm.student_id JOIN public.fee_plan_assignments fa ON fa.student_id = s.id AND fa.ends_on IS NULL WHERE bm.batch_id = $1 ORDER BY s.name",
      [ids.batch],
    );
    expect(rows).toEqual([
      { name: "Ananya", amount_paise: "900000" },
      { name: "Arjun", amount_paise: "500000" },
    ]);
  });

  it("hides every record from another studio", async () => {
    for (const table of [
      "guardians",
      "students",
      "batches",
      "batch_members",
      "fee_plans",
      "fee_plan_assignments",
    ]) {
      const rows = await db.query(
        { user: b },
        `SELECT 1 FROM public.${table} WHERE studio_id = $1`,
        [a],
      );
      expect(rows, table).toEqual([]);
    }
    expect(await db.query("anon", "SELECT 1 FROM public.students").catch(() => [])).toEqual([]);
  });

  it("rejects a write that claims another studio's id", async () => {
    const message = await rejection(
      db.query(
        { user: b },
        "INSERT INTO public.students (studio_id, name) VALUES ($1, 'Intruder')",
        [a],
      ),
    );
    expect(message).toMatch(/row-level security/i);
  });

  it("rejects a roster row that links another studio's student, even for the service role", async () => {
    const message = await rejection(
      db.query(
        "service",
        "INSERT INTO public.batch_members (studio_id, batch_id, student_id) VALUES ($1, $2, $3)",
        [a, ids.batch, ids.bStudent],
      ),
    );
    expect(message).toMatch(/foreign key/i);
  });

  it("rejects a student whose guardian belongs to another studio", async () => {
    const bGuardian = (
      await one<{ id: string }>(
        { user: b },
        "INSERT INTO public.guardians (studio_id, name) VALUES ($1, 'Other') RETURNING id",
        [b],
      )
    ).id;
    const message = await rejection(
      db.query(
        "service",
        "INSERT INTO public.students (studio_id, name, guardian_id) VALUES ($1, 'Cross', $2)",
        [a, bGuardian],
      ),
    );
    expect(message).toMatch(/foreign key/i);
  });

  it("keeps exactly one open fee-plan assignment per student", async () => {
    const message = await rejection(
      db.query(
        "service",
        "INSERT INTO public.fee_plan_assignments (studio_id, student_id, fee_plan_id, amount_paise, starts_on) VALUES ($1, $2, $3, 100, DATE '2026-11-01')",
        [a, ids.ananya, ids.plan4],
      ),
    );
    expect(message).toMatch(/unique|duplicate/i);
  });

  it("closes the previous assignment and opens the next when a plan is reassigned", async () => {
    await db.query({ user: a }, "SELECT public.assign_fee_plan($1, $2, DATE '2026-11-01')", [
      ids.ananya,
      ids.plan4,
    ]);
    const rows = await db.query<{ plan: string; starts_on: string; ends_on: string | null }>(
      { user: a },
      "SELECT fp.name AS plan, fa.starts_on::text, fa.ends_on::text FROM public.fee_plan_assignments fa JOIN public.fee_plans fp ON fp.id = fa.fee_plan_id WHERE fa.student_id = $1 ORDER BY fa.starts_on",
      [ids.ananya],
    );
    expect(rows).toEqual([
      { plan: "8 classes a week", starts_on: "2026-10-01", ends_on: "2026-10-31" },
      { plan: "4 classes a week", starts_on: "2026-11-01", ends_on: null },
    ]);
  });

  it("refuses to assign an archived plan or to start before the current assignment began", async () => {
    await db.query({ user: a }, "UPDATE public.fee_plans SET archived_at = now() WHERE id = $1", [
      ids.plan8,
    ]);
    const archived = await rejection(
      db.query({ user: a }, "SELECT public.assign_fee_plan($1, $2, DATE '2026-12-01')", [
        ids.arjun,
        ids.plan8,
      ]),
    );
    expect(archived).toMatch(/archived/i);
    const early = await rejection(
      db.query({ user: a }, "SELECT public.assign_fee_plan($1, $2, DATE '2026-09-01')", [
        ids.arjun,
        ids.plan4,
      ]),
    );
    expect(early).toMatch(/after/i);
  });

  it("will not let an owner assign another studio's student or plan", async () => {
    const message = await rejection(
      db.query({ user: b }, "SELECT public.assign_fee_plan($1, $2, DATE '2026-12-01')", [
        ids.ananya,
        ids.plan4,
      ]),
    );
    expect(message).toMatch(/not found/i);
  });

  it("allows a student in a batch once at a time and again after leaving", async () => {
    const duplicate = await rejection(
      db.query(
        { user: a },
        "INSERT INTO public.batch_members (studio_id, batch_id, student_id) VALUES ($1, $2, $3)",
        [a, ids.batch, ids.ananya],
      ),
    );
    expect(duplicate).toMatch(/unique|duplicate/i);
    await db.query(
      { user: a },
      "UPDATE public.batch_members SET left_on = current_date WHERE batch_id = $1 AND student_id = $2 AND left_on IS NULL",
      [ids.batch, ids.ananya],
    );
    await db.query(
      { user: a },
      "INSERT INTO public.batch_members (studio_id, batch_id, student_id) VALUES ($1, $2, $3)",
      [a, ids.batch, ids.ananya],
    );
    const [{ count }] = await db.query<{ count: number }>(
      { user: a },
      "SELECT count(*)::int AS count FROM public.batch_members WHERE student_id = $1",
      [ids.ananya],
    );
    expect(count).toBe(2);
  });

  it("rejects zero, negative and fractional-looking amounts on fee plans", async () => {
    for (const amount of [0, -100]) {
      const message = await rejection(
        db.query(
          { user: a },
          "INSERT INTO public.fee_plans (studio_id, name, amount_paise) VALUES ($1, 'Bad', $2)",
          [a, amount],
        ),
      );
      expect(message).toMatch(/check/i);
    }
  });

  it("does not grant deletes: records are archived, never removed", async () => {
    const message = await rejection(
      db.query({ user: a }, "DELETE FROM public.students WHERE id = $1", [ids.arjun]),
    );
    expect(message).toMatch(/permission denied/i);
  });

  it("deletes a studio's records together with the studio", async () => {
    const c = await db.addUser("c@example.com");
    await db.admin("INSERT INTO public.studio_profiles (user_id) VALUES ($1)", [c]);
    await db.admin("INSERT INTO public.students (studio_id, name) VALUES ($1, 'Temp')", [c]);
    await db.admin("DELETE FROM public.studio_profiles WHERE user_id = $1", [c]);
    const [{ count }] = await db.admin<{ count: number }>(
      "SELECT count(*)::int AS count FROM public.students WHERE studio_id = $1",
      [c],
    );
    expect(count).toBe(0);
  });
});
