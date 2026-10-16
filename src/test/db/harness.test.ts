// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";

describe("SQL harness against the existing migrations", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await createDb();
    alice = await db.addUser("alice@example.com");
    bob = await db.addUser("bob@example.com");
    await db.admin(
      "INSERT INTO public.studio_profiles (user_id, name, studio_name) VALUES ($1, 'Alice', 'Alice Studio'), ($2, 'Bob', 'Bob Studio')",
      [alice, bob],
    );
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  it("applies migrations 0000 to 0002 to an empty database", async () => {
    const tables = await db.admin<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1",
    );
    expect(tables.map((t) => t.table_name)).toEqual(
      expect.arrayContaining(["studio_profiles", "user_roles", "waitlist_signups"]),
    );
  });

  it("lets an owner read only their own studio profile", async () => {
    const rows = await db.query<{ studio_name: string }>({ user: alice }, "SELECT studio_name FROM public.studio_profiles");
    expect(rows).toEqual([{ studio_name: "Alice Studio" }]);
  });

  it("lets an owner edit contact fields but not plan", async () => {
    await db.query({ user: alice }, "UPDATE public.studio_profiles SET studio_name = 'Alice Dance' WHERE user_id = $1", [alice]);
    const message = await rejection(
      db.query({ user: alice }, "UPDATE public.studio_profiles SET plan = 'studio' WHERE user_id = $1", [alice]),
    );
    expect(message).toMatch(/permission denied/i);
  });

  it("lets the service role change plan", async () => {
    await db.query("service", "UPDATE public.studio_profiles SET plan = 'growth' WHERE user_id = $1", [bob]);
    const [row] = await db.admin<{ plan: string }>("SELECT plan FROM public.studio_profiles WHERE user_id = $1", [bob]);
    expect(row.plan).toBe("growth");
  });

  it("hides the waitlist from anonymous callers and from owners without the owner role", async () => {
    await db.admin(
      "INSERT INTO public.waitlist_signups (studio_name, whatsapp_number, student_bucket, consent) VALUES ('Hidden', '+919999999999', '10-25', true)",
    );
    const anon = await db.query("anon", "SELECT id FROM public.waitlist_signups").catch(() => []);
    expect(anon).toEqual([]);
    const plainOwner = await db.query({ user: alice }, "SELECT id FROM public.waitlist_signups");
    expect(plainOwner).toEqual([]);
  });

  it("gives each test file an isolated database", async () => {
    const other = await createDb();
    try {
      const [{ count }] = await other.admin<{ count: number }>("SELECT count(*)::int AS count FROM public.studio_profiles");
      expect(count).toBe(0);
    } finally {
      await other.close();
    }
  }, 60_000);
});
