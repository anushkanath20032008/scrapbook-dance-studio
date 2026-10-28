// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newGuardian, newStudent, newStudio, payment } from "./fixtures";

describe("reminders: queueing and claiming", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const generate = (owner: string, period: string) =>
    db.query({ user: owner }, "SELECT public.generate_monthly_charges($1::date)", [period]);
  const queue = (owner: string, period: string, today: string) =>
    db
      .query<{ n: number }>(
        { user: owner },
        "SELECT public.queue_fee_reminders($1::date, $2::date) AS n",
        [period, today],
      )
      .then((r) => r[0].n);
  const reminders = (owner: string) =>
    db.query<{
      kind: string;
      status: string;
      payload: Record<string, unknown>;
      student_id: string;
    }>(
      { user: owner },
      "SELECT kind, status, payload, student_id FROM public.reminders ORDER BY kind, created_at",
    );

  it("queues one reminder per overdue charge and none for paid charges", async () => {
    const owner = await newStudio(db, "Dance Hub");
    const late = await newStudent(db, owner, "Late", {
      amountPaise: 900000,
      guardian: await newGuardian(db, owner, "Ritu"),
      planName: "p1",
    });
    const paid = await newStudent(db, owner, "Paid", {
      amountPaise: 500000,
      guardian: await newGuardian(db, owner, "Meera"),
      planName: "p2",
    });
    await generate(owner, "2026-10-01");
    await payment(db, owner, paid.id, 500000);
    expect(await queue(owner, "2026-10-01", "2026-10-10")).toBe(1);
    const rows = await reminders(owner);
    expect(rows.map((r) => [r.kind, r.status, r.student_id])).toEqual([
      ["fee_overdue", "queued", late.id],
    ]);
    expect(rows[0].payload).toMatchObject({
      student_name: "Late",
      guardian_name: "Ritu",
      studio_name: "Dance Hub",
      amount_paise: 900000,
    });
  });

  it("queues a due-kind reminder before the due date", async () => {
    const owner = await newStudio(db);
    await newStudent(db, owner, "Soon", {
      amountPaise: 400000,
      guardian: await newGuardian(db, owner),
    });
    await generate(owner, "2026-10-01");
    expect(await queue(owner, "2026-10-01", "2026-10-02")).toBe(1);
    expect((await reminders(owner)).map((r) => r.kind)).toEqual(["fee_due"]);
  });

  it("queues nothing the second time on the same day, and queues again the next day", async () => {
    const owner = await newStudio(db);
    await newStudent(db, owner, "Kabir", {
      amountPaise: 400000,
      guardian: await newGuardian(db, owner),
    });
    await generate(owner, "2026-10-01");
    expect(await queue(owner, "2026-10-01", "2026-10-10")).toBe(1);
    expect(await queue(owner, "2026-10-01", "2026-10-10")).toBe(0);
    expect(await queue(owner, "2026-10-01", "2026-10-11")).toBe(1);
  });

  it("skips guardians who opted out and students without a guardian", async () => {
    const owner = await newStudio(db);
    const quiet = await newGuardian(db, owner, "Quiet", { optedOut: true });
    await newStudent(db, owner, "Opted out", {
      amountPaise: 400000,
      guardian: quiet,
      planName: "p1",
    });
    await newStudent(db, owner, "No guardian", { amountPaise: 400000, planName: "p2" });
    await generate(owner, "2026-10-01");
    expect(await queue(owner, "2026-10-01", "2026-10-10")).toBe(0);
  });

  it("takes the studio from the caller, so another owner queues nothing for these charges", async () => {
    const owner = await newStudio(db);
    const other = await newStudio(db);
    await newStudent(db, owner, "Mine", {
      amountPaise: 400000,
      guardian: await newGuardian(db, owner),
    });
    await generate(owner, "2026-10-01");
    expect(await queue(other, "2026-10-01", "2026-10-10")).toBe(0);
    expect(await reminders(other)).toEqual([]);
    expect(
      await db
        .query("anon", "SELECT public.queue_fee_reminders(DATE '2026-10-01')")
        .catch(() => "denied"),
    ).toBe("denied");
  });

  it("scopes a studio with no students to nothing rather than to every studio", async () => {
    const owner = await newStudio(db);
    const empty = await newStudio(db);
    await newStudent(db, owner, "Mine", {
      amountPaise: 400000,
      guardian: await newGuardian(db, owner),
    });
    await generate(owner, "2026-10-01");
    expect(await queue(empty, "2026-10-01", "2026-10-10")).toBe(0);
  });

  it("does not let owners insert or edit reminders directly", async () => {
    const owner = await newStudio(db);
    const guardian = await newGuardian(db, owner);
    const s = await newStudent(db, owner, "Direct", { amountPaise: 400000, guardian });
    await generate(owner, "2026-10-01");
    await queue(owner, "2026-10-01", "2026-10-10");
    const [charge] = await db.admin<{ id: string }>(
      "SELECT id FROM public.charges WHERE studio_id = $1",
      [owner],
    );
    const insert = db.query(
      { user: owner },
      "INSERT INTO public.reminders (studio_id, guardian_id, student_id, charge_id, kind, template_name, payload, dedupe_key) VALUES ($1, $2, $3, $4, 'fee_due', 't', '{}', 'direct-1')",
      [owner, guardian, s.id, charge.id],
    );
    expect(await rejection(insert)).toMatch(/permission denied/i);
    expect(
      await rejection(db.query({ user: owner }, "UPDATE public.reminders SET status = 'sent'")),
    ).toMatch(/permission denied/i);
  });

  async function seedQueued(count: number) {
    const owner = await newStudio(db);
    for (let i = 0; i < count; i++) {
      await newStudent(db, owner, `Student ${i}`, {
        amountPaise: 100000,
        guardian: await newGuardian(db, owner, `G${i}`),
        planName: `plan ${i}`,
      });
    }
    await generate(owner, "2026-10-01");
    await queue(owner, "2026-10-01", "2026-10-10");
    await db.admin(
      "UPDATE public.studio_profiles SET plan = $2, billing_status = $3, whatsapp_automation = true WHERE user_id = $1",
      [owner, "studio", "active"],
    );
    return owner;
  }
  const claim = (limit: number, lease = 300) =>
    db.query<{ id: string; status: string; attempts: number; studio_id: string }>(
      "service",
      "SELECT id, status, attempts, studio_id FROM public.claim_due_reminders($1, $2)",
      [limit, lease],
    );

  it("claims queued rows as sending without counting an attempt, and does not hand them out again while the lease lives", async () => {
    const owner = await seedQueued(2);
    const first = (await claim(10)).filter((r) => r.studio_id === owner);
    expect(first.map((r) => [r.status, r.attempts])).toEqual([
      ["sending", 0],
      ["sending", 0],
    ]);
    expect((await claim(10)).filter((r) => r.studio_id === owner)).toEqual([]);
  });

  it("hands a row out again after its lease expires and counts that as an attempt", async () => {
    const owner = await seedQueued(1);
    const first = (await claim(10)).filter((r) => r.studio_id === owner);
    expect(first).toHaveLength(1);
    await db.admin(
      "UPDATE public.reminders SET lease_expires_at = now() - interval '1 minute' WHERE studio_id = $1",
      [owner],
    );
    const again = (await claim(10)).filter((r) => r.studio_id === owner);
    expect(again.map((r) => [r.status, r.attempts])).toEqual([["sending", 1]]);
  });

  it("honors the limit and skips rows scheduled for later", async () => {
    const owner = await seedQueued(3);
    await db.admin(
      "UPDATE public.reminders SET next_attempt_at = now() + interval '1 hour' WHERE id = (SELECT id FROM public.reminders WHERE studio_id = $1 LIMIT 1)",
      [owner],
    );
    const claimed = (await claim(1)).filter((r) => r.studio_id === owner);
    expect(claimed).toHaveLength(1);
    const rest = (await claim(10)).filter((r) => r.studio_id === owner);
    expect(rest).toHaveLength(1);
  });

  it("does not let owners or anonymous callers claim reminders", async () => {
    const owner = await seedQueued(1);
    expect(
      await rejection(db.query({ user: owner }, "SELECT * FROM public.claim_due_reminders(5, 60)")),
    ).toMatch(/permission denied/i);
    expect(
      await rejection(db.query("anon", "SELECT * FROM public.claim_due_reminders(5, 60)")),
    ).toMatch(/permission denied/i);
  });

  it("claims without overlap when two callers run at once, when a real Postgres is configured", async () => {
    const url = process.env["TEST_DATABASE_URL"];
    if (!url) return; // skipped without TEST_DATABASE_URL; PGlite is a single session
    const { default: postgres } = await import("postgres");
    const [one, two] = [postgres(url, { max: 1 }), postgres(url, { max: 1 })];
    try {
      const [a, b] = await Promise.all([
        one`SELECT id FROM public.claim_due_reminders(100, 60)`,
        two`SELECT id FROM public.claim_due_reminders(100, 60)`,
      ]);
      const seen = new Set(a.map((r) => r["id"] as string));
      expect(b.some((r) => seen.has(r["id"] as string))).toBe(false);
    } finally {
      await Promise.all([one.end(), two.end()]);
    }
  });
});
