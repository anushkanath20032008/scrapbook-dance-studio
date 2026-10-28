// @vitest-environment node
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newStudio } from "./fixtures";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

describe("photo read quota", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const take = (user: string, pages = 1) =>
    db.query<{ used: number }>({ user }, "SELECT public.take_photo_reads($1) AS used", [pages]);
  const rows = async (studio: string) =>
    Number((await db.admin<{ n: string }>("SELECT count(*)::text AS n FROM public.photo_reads WHERE studio_id = $1", [studio]))[0].n);

  it("counts pages and refuses past 30 in 24 hours, with a plain message and nothing recorded", async () => {
    const owner = await newStudio(db);
    expect((await take(owner, 6))[0].used).toBe(6);
    for (let i = 0; i < 4; i++) await take(owner, 6);
    expect(await rows(owner)).toBe(30);
    expect(await rejection(take(owner, 1))).toMatch(/30 pages.*24 hours|try again/i);
    expect(await rows(owner)).toBe(30);
    // A request that would cross the line is refused whole.
    const other = await newStudio(db);
    for (let i = 0; i < 4; i++) await take(other, 6);
    await take(other, 4);
    expect(await rejection(take(other, 6))).toMatch(/30 pages/);
    expect(await rows(other)).toBe(28);
  });

  it("stops counting pages older than 24 hours", async () => {
    const owner = await newStudio(db);
    for (let i = 0; i < 5; i++) await take(owner, 6);
    await db.admin("UPDATE public.photo_reads SET read_at = now() - interval '25 hours' WHERE studio_id = $1", [owner]);
    expect((await take(owner, 1))[0].used).toBe(1);
  });

  it("credits a failed page back, so a failure plus its retry costs one page", async () => {
    const owner = await newStudio(db);
    await take(owner, 1);
    await db.query({ user: owner }, "SELECT public.credit_photo_read()");
    expect(await rows(owner)).toBe(0);
    await take(owner, 1);
    expect(await rows(owner)).toBe(1);
    // Crediting with nothing to credit does nothing, and never touches another studio's pages.
    const other = await newStudio(db);
    await take(other, 2);
    await db.query({ user: owner }, "SELECT public.credit_photo_read()");
    await db.query({ user: owner }, "SELECT public.credit_photo_read()");
    expect(await rows(owner)).toBe(0);
    expect(await rows(other)).toBe(2);
  });

  it("rejects nonsense page counts", async () => {
    const owner = await newStudio(db);
    expect(await rejection(take(owner, 0))).toMatch(/pages/);
    expect(await rejection(take(owner, 7))).toMatch(/pages/);
  });

  it("is for the studio owner only: a Dance teacher, a stranger and anonymous callers are refused", async () => {
    const owner = await newStudio(db);
    const teacher = await db.addUser("photo-teacher@example.com");
    await db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite(NULL, 7, $1, $2)", [sha("p-token"), sha("p-code")]);
    await db.admin("UPDATE public.studio_instructors SET user_id = $1, accepted_at = now() WHERE token_hash = $2", [teacher, sha("p-token")]);
    expect(await rejection(take(teacher))).toMatch(/studio owner/);
    expect(await rejection(take(await db.addUser()))).toMatch(/studio owner/);
    expect(await rejection(db.query("anon", "SELECT public.take_photo_reads(1)"))).toMatch(/permission denied/i);
    expect(await rows(owner)).toBe(0);
  });

  it("keeps the table closed to everyone but the server role, and stores no content", async () => {
    const owner = await newStudio(db);
    await take(owner, 1);
    expect(await rejection(db.query({ user: owner }, "SELECT * FROM public.photo_reads"))).toMatch(/permission denied/i);
    expect(await rejection(db.query({ user: owner }, "DELETE FROM public.photo_reads"))).toMatch(/permission denied/i);
    expect(await rejection(db.query("anon", "SELECT * FROM public.photo_reads"))).toMatch(/permission denied/i);
    const columns = await db.admin<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'photo_reads' ORDER BY column_name",
    );
    expect(columns.map((c) => c.column_name)).toEqual(["id", "read_at", "studio_id"]);
  });
});
