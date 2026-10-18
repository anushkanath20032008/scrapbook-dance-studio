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

  it("reports member tables left open and member functions callable without signing in", async () => {
    const db2 = await createDb();
    try {
      await db2.admin("GRANT SELECT (token_hash) ON public.member_invites TO authenticated");
      await db2.admin("GRANT UPDATE (guardian_id) ON public.member_links TO authenticated");
      await db2.admin("GRANT SELECT ON public.invite_attempts TO authenticated");
      await db2.admin("GRANT EXECUTE ON FUNCTION public.member_view(uuid) TO anon");
      const found = (await db2.pg.query<{ problem: string }>(checks.trim().replace(/;$/, ""))).rows.map((row) => row.problem);
      expect(found).toEqual(
        expect.arrayContaining([
          "owners can read member_invites.token_hash",
          "owners or members can write member_links.guardian_id (UPDATE)",
          "owners can reach invite_attempts",
          "anon can run member_view",
        ]),
      );
    } finally {
      await db2.close();
    }
  }, 60_000);

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
