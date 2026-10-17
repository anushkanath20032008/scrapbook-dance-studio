// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type TestDb } from "./harness";

const checks = readFileSync(join(process.cwd(), "drizzle", "verify", "rollout-checks.sql"), "utf8");

describe("rollout checks", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const problems = async () =>
    (await db.pg.query<{ problem: string }>(checks.trim().replace(/;$/, ""))).rows.map(
      (row) => row.problem,
    );

  it("finds nothing wrong after the migrations are applied", async () => {
    expect(await problems()).toEqual([]);
  });

  it("reports a table left open, a missing policy and a billing column an owner could write", async () => {
    await db.admin("GRANT DELETE ON public.charges TO authenticated");
    await db.admin("GRANT UPDATE (plan) ON public.studio_profiles TO authenticated");
    await db.admin("GRANT SELECT ON public.family_links TO anon");
    await db.admin("ALTER TABLE public.batches DISABLE ROW LEVEL SECURITY");
    await db.admin(
      "GRANT EXECUTE ON FUNCTION public.claim_due_reminders(integer, integer) TO authenticated",
    );
    const found = await problems();
    expect(found).toEqual(
      expect.arrayContaining([
        "owners can delete from charges",
        "owners can set billing column plan (UPDATE)",
        "anon can reach family_links (SELECT)",
        "row-level security is off: batches",
        "owners can run claim_due_reminders",
      ]),
    );
  });
});
