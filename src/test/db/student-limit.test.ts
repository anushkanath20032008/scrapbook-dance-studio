// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newStudio } from "./fixtures";

describe("dancer limit by plan", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const addDancers = (studio: string, count: number) =>
    db.admin(
      "INSERT INTO public.students (studio_id, name) SELECT $1, 'Dancer ' || g FROM generate_series(1, $2::int) g",
      [studio, count],
    );
  const addOne = (studio: string) =>
    db.query({ user: studio }, "INSERT INTO public.students (studio_id, name) VALUES ($1, 'One more')", [studio]);
  const afterTrial = (studio: string, plan = "waitlist", status = "not_started") =>
    db.admin(
      "UPDATE public.studio_profiles SET created_at = now() - interval '40 days', plan = $2, billing_status = $3 WHERE user_id = $1",
      [studio, plan, status],
    );
  const limitOf = async (studio: string) =>
    (await db.admin<{ l: number | null }>("SELECT public.student_limit($1) AS l", [studio]))[0].l;

  it("has no limit during the first 30 days", async () => {
    const studio = await newStudio(db);
    expect(await limitOf(studio)).toBeNull();
    await addDancers(studio, 60);
    await addOne(studio);
  });

  it("caps Regular and a studio with no plan at 50 after the free month", async () => {
    const studio = await newStudio(db);
    await afterTrial(studio);
    expect(await limitOf(studio)).toBe(50);
    await addDancers(studio, 50);
    expect(await rejection(addOne(studio))).toContain("50 dancer limit");

    const regular = await newStudio(db);
    await afterTrial(regular, "starter", "active");
    expect(await limitOf(regular)).toBe(50);
  });

  it("does not remove anyone, but archiving frees a place and restoring is capped", async () => {
    const studio = await newStudio(db);
    await addDancers(studio, 55); // added during the free month
    await afterTrial(studio);
    await db.admin("UPDATE public.students SET archived_at = now() WHERE studio_id = $1 AND name IN ('Dancer 1', 'Dancer 2')", [studio]);
    const [{ n }] = await db.admin<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.students WHERE studio_id = $1 AND archived_at IS NULL",
      [studio],
    );
    expect(n).toBe(53);
    // Still over the cap, so a new dancer and a restored one are both refused.
    expect(await rejection(addOne(studio))).toContain("dancer limit");
    expect(
      await rejection(
        db.admin("UPDATE public.students SET archived_at = NULL WHERE studio_id = $1 AND name = 'Dancer 1'", [studio]),
      ),
    ).toContain("dancer limit");
    // Archiving more is always allowed.
    await db.admin("UPDATE public.students SET archived_at = now() WHERE studio_id = $1 AND name = 'Dancer 3'", [studio]);
  });

  it("lets Studio+ grow, keeps the older Growth plan at 150, and caps a cancelled plan", async () => {
    const plus = await newStudio(db);
    await afterTrial(plus, "studio", "active");
    expect(await limitOf(plus)).toBeNull();
    await addDancers(plus, 120);
    await addOne(plus);

    const late = await newStudio(db);
    await afterTrial(late, "studio", "past_due");
    expect(await limitOf(late)).toBeNull();

    const growth = await newStudio(db);
    await afterTrial(growth, "growth", "active");
    expect(await limitOf(growth)).toBe(150);

    const cancelled = await newStudio(db);
    await afterTrial(cancelled, "studio", "cancelled");
    expect(await limitOf(cancelled)).toBe(50);
  });

  it("shows an owner their own capacity and nobody else's", async () => {
    const studio = await newStudio(db);
    await afterTrial(studio);
    await addDancers(studio, 12);
    const other = await newStudio(db);
    await addDancers(other, 5);
    const [mine] = await db.query<{ student_limit: number | null; student_count: number }>(
      { user: studio },
      "SELECT * FROM public.studio_capacity()",
    );
    expect(mine).toMatchObject({ student_limit: 50, student_count: 12 });
  });

  it("keeps the helper functions away from owners and anonymous callers", async () => {
    const studio = await newStudio(db);
    expect(
      await rejection(db.query({ user: studio }, "SELECT public.student_limit($1)", [studio])),
    ).toBeTruthy();
    expect(await rejection(db.query("anon", "SELECT * FROM public.studio_capacity()"))).toBeTruthy();
  });
});
