// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newGuardian, newStudent, newStudio, payment } from "./fixtures";

type Preview = {
  student_name: string;
  phone: string | null;
  outstanding_paise: string;
  status: string;
  skip_reason: string | null;
};

describe("reminder preview and queueing", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const generate = (owner: string, period: string, dueOn: string) =>
    db.query({ user: owner }, "SELECT public.generate_monthly_charges($1::date, $2::date)", [
      period,
      dueOn,
    ]);
  const preview = (
    owner: string,
    today: string,
    options: { student?: string | null; onlyOverdue?: boolean } = {},
  ) =>
    db.query<Preview>(
      { user: owner },
      "SELECT student_name, phone, outstanding_paise::text, status, skip_reason FROM public.preview_fee_reminders('2026-10-01'::date, $1::date, $2, $3)",
      [today, options.student ?? null, options.onlyOverdue ?? false],
    );
  const queue = (
    owner: string,
    today: string,
    options: { student?: string | null; onlyOverdue?: boolean } = {},
  ) =>
    db
      .query<{ n: number }>(
        { user: owner },
        "SELECT public.queue_fee_reminders('2026-10-01'::date, $1::date, $2, $3) AS n",
        [today, options.student ?? null, options.onlyOverdue ?? false],
      )
      .then((rows) => rows[0].n);
  const queuedNames = (owner: string) =>
    db
      .query<{ name: string }>(
        { user: owner },
        "SELECT payload ->> 'student_name' AS name FROM public.reminders ORDER BY 1",
      )
      .then((rows) => rows.map((r) => r.name));

  async function fixture() {
    const owner = await newStudio(db, "Dance Hub");
    const due = await newStudent(db, owner, "Due later", {
      amountPaise: 100000,
      guardian: await newGuardian(db, owner, "A"),
    });
    const overdue = await newStudent(db, owner, "Overdue", {
      amountPaise: 100000,
      guardian: await newGuardian(db, owner, "B"),
    });
    const paid = await newStudent(db, owner, "Paid", {
      amountPaise: 100000,
      guardian: await newGuardian(db, owner, "C"),
    });
    const optedOut = await newStudent(db, owner, "Opted out", {
      amountPaise: 100000,
      guardian: await newGuardian(db, owner, "D", { optedOut: true }),
    });
    const noPhone = await newStudent(db, owner, "No phone", { amountPaise: 100000 });
    await generate(owner, "2026-10-01", "2026-10-05");
    await db.admin("UPDATE public.charges SET due_on = '2026-10-25' WHERE student_id = $1", [
      due.id,
    ]);
    await payment(db, owner, paid.id, 100000);
    return { owner, due, overdue, paid, optedOut, noPhone };
  }

  it("previews exactly who would be messaged and why anyone is skipped", async () => {
    const { owner } = await fixture();
    const rows = await preview(owner, "2026-10-10", { onlyOverdue: true });
    const byName = Object.fromEntries(rows.map((r) => [r.student_name, r.skip_reason]));
    expect(byName).toEqual({
      Overdue: null,
      "Opted out": "opted out",
      "No phone": "no contact",
    });
    expect(rows.map((r) => r.student_name)).not.toContain("Paid");
    expect(rows.map((r) => r.student_name)).not.toContain("Due later");
  });

  it("queues only the people the overdue preview lists as sendable", async () => {
    const { owner } = await fixture();
    expect(await queue(owner, "2026-10-10", { onlyOverdue: true })).toBe(1);
    expect(await queuedNames(owner)).toEqual(["Overdue"]);
  });

  it("queues one dancer only, due or overdue, when asked", async () => {
    const { owner, due } = await fixture();
    expect(await queue(owner, "2026-10-10", { student: due.id })).toBe(1);
    expect(await queuedNames(owner)).toEqual(["Due later"]);
    const [row] = await db.query<{ kind: string }>(
      { user: owner },
      "SELECT kind FROM public.reminders",
    );
    expect(row.kind).toBe("fee_due");
  });

  it("includes due charges when not limited to overdue, as before", async () => {
    const { owner } = await fixture();
    expect(await queue(owner, "2026-10-10")).toBe(2);
    expect(await queuedNames(owner)).toEqual(["Due later", "Overdue"]);
  });

  it("creates one reminder per charge per day, and the preview then says already queued", async () => {
    const { owner } = await fixture();
    expect(await queue(owner, "2026-10-10", { onlyOverdue: true })).toBe(1);
    expect(await queue(owner, "2026-10-10", { onlyOverdue: true })).toBe(0);
    const rows = await preview(owner, "2026-10-10", { onlyOverdue: true });
    expect(rows.find((r) => r.student_name === "Overdue")?.skip_reason).toBe(
      "already queued today",
    );
    expect(await queue(owner, "2026-10-11", { onlyOverdue: true })).toBe(1);
  });

  it("skips a dancer whose contact has no phone number", async () => {
    const owner = await newStudio(db);
    const [contact] = await db.admin<{ id: string }>(
      "INSERT INTO public.guardians (studio_id, name, phone) VALUES ($1, 'Nophone', NULL) RETURNING id",
      [owner],
    );
    await newStudent(db, owner, "Silent", { amountPaise: 100000, guardian: contact.id });
    await generate(owner, "2026-10-01", "2026-10-05");
    expect((await preview(owner, "2026-10-10"))[0]?.skip_reason).toBe("no phone");
    expect(await queue(owner, "2026-10-10")).toBe(0);
  });

  it("never previews or queues another studio's dancers", async () => {
    const { owner, overdue } = await fixture();
    const stranger = await newStudio(db);
    expect(await preview(stranger, "2026-10-10")).toEqual([]);
    expect(await preview(stranger, "2026-10-10", { student: overdue.id })).toEqual([]);
    expect(await queue(stranger, "2026-10-10", { student: overdue.id })).toBe(0);
    expect(await queuedNames(stranger)).toEqual([]);
    void owner;
  });

  it("returns nothing from reminder_targets itself for another studio's dancers", async () => {
    const { overdue } = await fixture();
    const stranger = await newStudio(db);
    const rows = await db.query(
      { user: stranger },
      "SELECT * FROM public.reminder_targets('2026-10-01'::date, '2026-10-10'::date, $1, false)",
      [overdue.id],
    );
    expect(rows).toEqual([]);
  });

  it("is not available to anonymous callers", async () => {
    expect(
      await rejection(
        db.query("anon", "SELECT * FROM public.preview_fee_reminders('2026-10-01'::date)"),
      ),
    ).toMatch(/permission denied/i);
  });
});
