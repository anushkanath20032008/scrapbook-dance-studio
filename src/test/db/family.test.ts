// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newGuardian, newStudio } from "./fixtures";

describe("family links: access rules", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const link = (owner: string, guardian: string, hash: string) =>
    db.query<{ id: string }>(
      { user: owner },
      "INSERT INTO public.family_links (studio_id, guardian_id, token_hash) VALUES ($1, $2, $3) RETURNING id",
      [owner, guardian, hash],
    );

  it("lets an owner create and read links for their own guardian", async () => {
    const owner = await newStudio(db, "Hub");
    const guardian = await newGuardian(db, owner, "Ritu");
    await link(owner, guardian, "hash-own-1");
    const rows = await db.query<{ token_hash: string }>(
      { user: owner },
      "SELECT token_hash FROM public.family_links",
    );
    expect(rows).toHaveLength(1);
  });

  it("refuses a link for another studio's guardian or on another studio's behalf", async () => {
    const a = await newStudio(db, "A");
    const b = await newStudio(db, "B");
    const guardianOfA = await newGuardian(db, a, "Meera");
    expect(await rejection(link(b, guardianOfA, "hash-cross-1"))).toMatch(/foreign key|violates/i);
    expect(
      await rejection(
        db.query(
          { user: b },
          "INSERT INTO public.family_links (studio_id, guardian_id, token_hash) VALUES ($1, $2, 'hash-cross-2')",
          [a, guardianOfA],
        ),
      ),
    ).toMatch(/row-level security|permission/i);
  });

  it("hides links from other owners and from anonymous callers", async () => {
    const a = await newStudio(db, "A2");
    const b = await newStudio(db, "B2");
    await link(a, await newGuardian(db, a, "Sonal"), "hash-hide-1");
    expect(await db.query({ user: b }, "SELECT id FROM public.family_links")).toHaveLength(0);
    expect(await rejection(db.query("anon", "SELECT id FROM public.family_links"))).toMatch(
      /permission denied/i,
    );
  });

  it("lets an owner revoke a link once and never restore it", async () => {
    const owner = await newStudio(db, "Hub3");
    const [created] = await link(owner, await newGuardian(db, owner, "Pooja"), "hash-revoke-1");
    await db.query(
      { user: owner },
      "UPDATE public.family_links SET revoked_at = now() WHERE id = $1",
      [created.id],
    );
    expect(
      await rejection(
        db.query(
          { user: owner },
          "UPDATE public.family_links SET revoked_at = NULL WHERE id = $1",
          [created.id],
        ),
      ),
    ).toMatch(/revoked and cannot be restored/);
  });

  it("does not let an owner change which guardian or token a link points to", async () => {
    const owner = await newStudio(db, "Hub4");
    const [created] = await link(owner, await newGuardian(db, owner, "Anu"), "hash-edit-1");
    expect(
      await rejection(
        db.query({ user: owner }, "UPDATE public.family_links SET token_hash = 'x' WHERE id = $1", [
          created.id,
        ]),
      ),
    ).toMatch(/permission denied/i);
  });
});
