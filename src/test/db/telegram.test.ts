// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newGuardian, newStudio } from "./fixtures";

describe("telegram links: access rules and redeem", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const invite = (owner: string, guardian: string, hash: string) =>
    db.query<{ id: string }>(
      { user: owner },
      "INSERT INTO public.telegram_links (studio_id, guardian_id, token_hash) VALUES ($1, $2, $3) RETURNING id",
      [owner, guardian, hash],
    );
  const redeem = (hash: string, chat: number) =>
    db.query<{ outcome: string; studio_id: string | null; guardian_id: string | null }>(
      "service",
      "SELECT * FROM public.redeem_telegram_link($1, $2)",
      [hash, chat],
    );

  it("lets an owner create and read invites for their own dancer only", async () => {
    const a = await newStudio(db, "A");
    const b = await newStudio(db, "B");
    const guardianOfA = await newGuardian(db, a, "Meera");
    await invite(a, guardianOfA, "h-own-1");
    expect(
      await db.query({ user: a }, "SELECT id FROM public.telegram_links"),
    ).toHaveLength(1);
    expect(await rejection(invite(b, guardianOfA, "h-cross-1"))).toMatch(/foreign key|violates/i);
    const seenByB = await db.query({ user: b }, "SELECT id FROM public.telegram_links");
    expect(seenByB.length).toBe(0);
  });

  it("will not let an owner or anon set a chat id or redeem", async () => {
    const owner = await newStudio(db, "C");
    const guardian = await newGuardian(db, owner, "Ritu");
    expect(
      await rejection(
        db.query(
          { user: owner },
          "INSERT INTO public.telegram_links (studio_id, guardian_id, token_hash, chat_id, joined_at) VALUES ($1, $2, 'h-chat', 5, now())",
          [owner, guardian],
        ),
      ),
    ).toMatch(/row-level security|policy/i);
    const [row] = await invite(owner, guardian, "h-own-2");
    expect(
      await rejection(
        db.query({ user: owner }, "UPDATE public.telegram_links SET chat_id = 9 WHERE id = $1", [
          row.id,
        ]),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await rejection(db.query({ user: owner }, "SELECT * FROM public.redeem_telegram_link('h-own-2', 9)")),
    ).toMatch(/permission denied/i);
    expect(
      await rejection(db.query("anon", "SELECT * FROM public.redeem_telegram_link('h-own-2', 9)")),
    ).toMatch(/permission denied/i);
  });

  it("redeems once: joined, then already for the same chat, invalid for any other", async () => {
    const owner = await newStudio(db, "D");
    const guardian = await newGuardian(db, owner, "Anu");
    await invite(owner, guardian, "h-once");
    const [joined] = await redeem("h-once", 1001);
    expect(joined).toMatchObject({ outcome: "joined", studio_id: owner, guardian_id: guardian });
    expect((await redeem("h-once", 1001))[0].outcome).toBe("already");
    expect((await redeem("h-once", 2002))[0]).toMatchObject({ outcome: "invalid", studio_id: null });
    expect((await redeem("no-such-hash", 1001))[0].outcome).toBe("invalid");
  });

  it("refuses a revoked invite and a revoked link stays revoked", async () => {
    const owner = await newStudio(db, "E");
    const guardian = await newGuardian(db, owner, "Kavya");
    const [row] = await invite(owner, guardian, "h-revoked");
    await db.query({ user: owner }, "UPDATE public.telegram_links SET revoked_at = now() WHERE id = $1", [
      row.id,
    ]);
    expect((await redeem("h-revoked", 3003))[0].outcome).toBe("invalid");
    expect(
      await rejection(
        db.query({ user: owner }, "UPDATE public.telegram_links SET revoked_at = NULL WHERE id = $1", [
          row.id,
        ]),
      ),
    ).toMatch(/permission denied|cannot be restored/i);
  });

  it("replaces a dancer's older chat when a newer invite is redeemed", async () => {
    const owner = await newStudio(db, "F");
    const guardian = await newGuardian(db, owner, "Isha");
    await invite(owner, guardian, "h-old");
    await redeem("h-old", 4004);
    await invite(owner, guardian, "h-new");
    expect((await redeem("h-new", 5005))[0].outcome).toBe("joined");
    const live = await db.query<{ chat_id: string }>(
      { user: owner },
      "SELECT chat_id FROM public.telegram_links WHERE chat_id IS NOT NULL AND revoked_at IS NULL",
    );
    expect(live.map((r) => Number(r.chat_id))).toEqual([5005]);
  });

  it("keeps the send log owner-readable and service-written only", async () => {
    const owner = await newStudio(db, "G");
    expect(
      await rejection(
        db.query(
          { user: owner },
          "INSERT INTO public.telegram_reminder_log (studio_id, charge_id, sent_on) VALUES ($1, gen_random_uuid(), current_date)",
          [owner],
        ),
      ),
    ).toMatch(/permission denied/i);
    expect(await db.query({ user: owner }, "SELECT id FROM public.telegram_reminder_log")).toBeDefined();
  });
});
