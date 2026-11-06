// @vitest-environment node
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newStudio } from "./fixtures";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

describe("batch requests", () => {
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
    const user = await db.addUser(`req-teacher-${n}@example.com`);
    const token = `r${n}`.padEnd(43, "t");
    await db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite($1, 7, $2, $3)", [
      null,
      sha(token),
      sha(`CODE${1000 + n}`),
    ]);
    await db.query({ user }, "SELECT public.redeem_instructor_invite($1)", [token]);
    return user;
  }

  const ask = (user: string, name: string) =>
    db.query<{ instructor_request_batch: string }>(
      { user },
      "SELECT public.instructor_request_batch($1, ARRAY[1,3]::smallint[], TIME '18:00', TIME '19:00', 'Studio A')",
      [name],
    );

  it("keeps a suggestion out of the studio's batches until the owner approves", async () => {
    const owner = await newStudio(db, "Natya");
    const teacher = await addInstructor(owner);
    const [{ instructor_request_batch: id }] = await ask(teacher, "Hip Hop evenings");

    const before = await db.admin("SELECT id FROM public.batches WHERE studio_id = $1", [owner]);
    expect(before).toHaveLength(0);
    const mine = await db.query<{ status: string }>({ user: teacher }, "SELECT * FROM public.instructor_my_batch_requests()");
    expect(mine.map((row) => row.status)).toEqual(["pending"]);

    const listed = await db.query<{ name: string }>({ user: owner }, "SELECT * FROM public.list_batch_requests()");
    expect(listed.map((row) => row.name)).toEqual(["Hip Hop evenings"]);

    await db.query({ user: owner }, "SELECT public.approve_batch_request($1)", [id]);
    const after = await db.admin("SELECT name, room FROM public.batches WHERE studio_id = $1", [owner]);
    expect(after).toEqual([{ name: "Hip Hop evenings", room: "Studio A" }]);
    await expect(
      db.query({ user: owner }, "SELECT public.approve_batch_request($1)", [id]),
    ).rejects.toThrow(/already decided/);
  });

  it("lets only the studio's owner decide, and only that studio's teachers file", async () => {
    const owner = await newStudio(db, "Natya");
    const otherOwner = await newStudio(db, "Other");
    const teacher = await addInstructor(owner);
    const [{ instructor_request_batch: id }] = await ask(teacher, "Salsa");

    expect(await rejection(db.query({ user: teacher }, "SELECT public.approve_batch_request($1)", [id]))).toMatch(/not found/);
    expect(await rejection(db.query({ user: otherOwner }, "SELECT public.approve_batch_request($1)", [id]))).toMatch(/not found/);
    expect(await db.query({ user: otherOwner }, "SELECT * FROM public.list_batch_requests()")).toHaveLength(0);
    const outsider = await db.addUser(`outsider-${++counter}@example.com`);
    expect(await rejection(ask(outsider, "Nope"))).toMatch(/do not have access/);
    expect(await rejection(db.query({ user: teacher }, "SELECT * FROM public.batch_requests"))).toMatch(/permission denied/);

    await db.query({ user: owner }, "SELECT public.decline_batch_request($1)", [id]);
    const mine = await db.query<{ status: string }>({ user: teacher }, "SELECT * FROM public.instructor_my_batch_requests()");
    expect(mine[0]?.status).toBe("declined");
  });
});
