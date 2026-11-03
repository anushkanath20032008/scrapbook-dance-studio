// @vitest-environment node
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type TestDb } from "./harness";
import { newStudio } from "./fixtures";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

describe("instructor_add_student", () => {
  let db: TestDb;
  let counter = 0;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  async function setup() {
    const n = ++counter;
    const owner = await newStudio(db, `Studio ${n}`);
    const teacher = await db.addUser(`add-teacher-${n}@example.com`);
    const token = `a${n}`.padEnd(43, "t");
    await db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite($1, 7, $2, $3)", [
      null,
      sha(token),
      sha(`CODE${2000 + n}`),
    ]);
    await db.query({ user: teacher }, "SELECT public.redeem_instructor_invite($1)", [token]);
    const [batch] = await db.admin<{ id: string }>(
      "INSERT INTO public.batches (studio_id, name) VALUES ($1, 'Hip Hop') RETURNING id",
      [owner],
    );
    return { owner, teacher, batch: batch!.id };
  }

  const add = (user: string, batch: string, name: string, phone: string) =>
    db.query<{ instructor_add_student: string }>({ user }, "SELECT public.instructor_add_student($1, $2, $3)", [
      batch,
      name,
      phone,
    ]);

  it("adds a dancer to the studio and the batch, and reuses the same dancer", async () => {
    const { owner, teacher, batch } = await setup();
    await add(teacher, batch, "  Asha   Rao ", "98765 43210");
    await add(teacher, batch, "asha rao", "98765 43210");
    const students = await db.admin("SELECT name FROM public.students WHERE studio_id = $1", [owner]);
    expect(students).toEqual([{ name: "Asha Rao" }]);
    const members = await db.admin("SELECT 1 FROM public.batch_members WHERE batch_id = $1", [batch]);
    expect(members).toHaveLength(1);
  });

  it("refuses a bad phone, an empty name and another studio's batch", async () => {
    const one = await setup();
    const two = await setup();
    await expect(add(one.teacher, one.batch, "Bela", "12")).rejects.toThrow(/phone/);
    await expect(add(one.teacher, one.batch, "  ", "")).rejects.toThrow(/name/);
    await expect(add(one.teacher, two.batch, "Bela", "")).rejects.toThrow(/batch not found/);
  });

  it("is closed to someone who is not a teacher", async () => {
    const { owner, batch } = await setup();
    await expect(add(owner, batch, "Bela", "")).rejects.toThrow(/access/);
  });
});
