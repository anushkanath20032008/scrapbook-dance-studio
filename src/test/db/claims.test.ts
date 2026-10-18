// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newGuardian, newStudent, newStudio } from "./fixtures";

type Claim = {
  id: string;
  status: string;
  payment_id: string | null;
  confirmed_paise: string | null;
};
type Queue = {
  claim_id: string;
  student_name: string;
  owed_paise: string;
  remaining_paise: string;
  excess_paise: string;
  possible_duplicate: boolean;
};

describe("payment claims", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  async function owing(amountPaise = 150000) {
    const owner = await newStudio(db);
    const contact = await newGuardian(db, owner, "Asha");
    const student = await newStudent(db, owner, "Asha", { amountPaise, guardian: contact });
    await db.query(
      { user: owner },
      "SELECT public.generate_monthly_charges('2026-10-01', '2026-10-05')",
    );
    return { owner, contact, student: student.id };
  }

  const submit = (
    contact: string,
    student: string,
    amount: number,
    options: { method?: string; reference?: string | null; paidOn?: string } = {},
  ) =>
    db
      .query<Claim>(
        "service",
        "SELECT id, status, payment_id, confirmed_paise::text FROM public.submit_payment_claim($1, $2, $3, $4, $5::date, $6)",
        [
          contact,
          student,
          amount,
          options.method ?? "upi",
          options.paidOn ?? "2026-10-06",
          options.reference === undefined ? "UTR-1" : options.reference,
        ],
      )
      .then((rows) => rows[0]);
  const queue = (owner: string) =>
    db.query<Queue>(
      { user: owner },
      "SELECT claim_id, student_name, owed_paise::text, remaining_paise::text, excess_paise::text, possible_duplicate FROM public.payment_claim_queue()",
    );
  const confirm = (owner: string, claim: string, amount: number | null = null, ack = false) =>
    db
      .query<Claim>(
        { user: owner },
        "SELECT id, status, payment_id, confirmed_paise::text FROM public.confirm_payment_claim($1, $2, $3)",
        [claim, amount, ack],
      )
      .then((rows) => rows[0]);
  const reject = (owner: string, claim: string, reason: string) =>
    db.query<Claim>(
      { user: owner },
      "SELECT id, status, payment_id, confirmed_paise::text FROM public.reject_payment_claim($1, $2)",
      [claim, reason],
    );
  const unpaid = (owner: string) =>
    db.query<{ outstanding_paise: string }>(
      { user: owner },
      "SELECT outstanding_paise::text FROM public.unpaid_students('2026-10-01', '2026-10-06')",
    );

  it("AE4: a pending claim changes no balance or total", async () => {
    const { owner, contact, student } = await owing();
    await submit(contact, student, 150000);
    expect(await unpaid(owner)).toEqual([{ outstanding_paise: "150000" }]);
    const [snap] = await db.query<{ collected_paise: string; missing_paise: string }>(
      { user: owner },
      "SELECT collected_paise::text, missing_paise::text FROM public.studio_snapshot('2026-10-01', '2026-10-06')",
    );
    expect(snap).toEqual({ collected_paise: "0", missing_paise: "150000" });
    const [{ count }] = await db.query<{ count: number }>(
      { user: owner },
      "SELECT count(*)::int AS count FROM public.payments",
    );
    expect(count).toBe(0);
  });

  it("shows the claimed amount beside what is owed", async () => {
    const { owner, contact, student } = await owing();
    await submit(contact, student, 100000);
    expect(await queue(owner)).toMatchObject([
      { student_name: "Asha", owed_paise: "150000", remaining_paise: "50000", excess_paise: "0" },
    ]);
  });

  it("AE5: flags a reference already on a live payment or another pending claim as a possible duplicate", async () => {
    const { owner, contact, student } = await owing();
    await db.query(
      { user: owner },
      "SELECT public.record_payment($1, 50000, 'upi', '2026-10-05'::date, NULL, 'dup-key-padding-1', 'UTR-DUP', false)",
      [student],
    );
    await submit(contact, student, 100000, { reference: "utr-dup" });
    expect((await queue(owner))[0]?.possible_duplicate).toBe(true);

    const second = await owing();
    const first = await submit(second.contact, second.student, 60000, { reference: "SAME-1" });
    await submit(second.contact, second.student, 60000, { reference: "same-1" });
    const rows = await queue(second.owner);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.possible_duplicate)).toBe(true);
    void first;
  });

  it("does not flag a unique reference, and a rejected claim's reference can be reused", async () => {
    const { owner, contact, student } = await owing();
    const first = await submit(contact, student, 100000, { reference: "UTR-RE" });
    expect((await queue(owner))[0]?.possible_duplicate).toBe(false);
    await reject(owner, first.id, "not on my statement");
    await submit(contact, student, 100000, { reference: "UTR-RE" });
    const rows = await queue(owner);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.possible_duplicate).toBe(false);
  });

  it("confirming records one ledger payment through the gate and clears the dancer", async () => {
    const { owner, contact, student } = await owing();
    const claim = await submit(contact, student, 150000);
    const done = await confirm(owner, claim.id);
    expect(done).toMatchObject({ status: "confirmed", confirmed_paise: "150000" });
    expect(done.payment_id).not.toBeNull();
    expect(await unpaid(owner)).toEqual([]);
    const [pay] = await db.query<{ reference: string; note: string }>(
      { user: owner },
      "SELECT reference, note FROM public.payments",
    );
    expect(pay).toEqual({ reference: "UTR-1", note: "Confirmed from a payment claim" });
  });

  it("confirming twice records one payment", async () => {
    const { owner, contact, student } = await owing();
    const claim = await submit(contact, student, 150000);
    const first = await confirm(owner, claim.id);
    const again = await confirm(owner, claim.id);
    expect(again.payment_id).toBe(first.payment_id);
    const [{ count }] = await db.query<{ count: number }>(
      { user: owner },
      "SELECT count(*)::int AS count FROM public.payments",
    );
    expect(count).toBe(1);
  });

  it("lets the owner adjust the amount, and needs acknowledgment for an excess", async () => {
    const { owner, contact, student } = await owing();
    const claim = await submit(contact, student, 200000);
    expect(await rejection(confirm(owner, claim.id))).toMatch(/more than what is owed/);
    expect((await queue(owner)).length).toBe(1);
    const adjusted = await confirm(owner, claim.id, 100000);
    expect(adjusted).toMatchObject({ status: "confirmed", confirmed_paise: "100000" });
    expect(await unpaid(owner)).toEqual([{ outstanding_paise: "50000" }]);
  });

  it("rejecting needs a reason and changes nothing", async () => {
    const { owner, contact, student } = await owing();
    const claim = await submit(contact, student, 150000);
    expect(await rejection(reject(owner, claim.id, "   "))).toMatch(/reason is required/);
    const [done] = await reject(owner, claim.id, "No such transfer");
    expect(done?.status).toBe("rejected");
    expect(await unpaid(owner)).toEqual([{ outstanding_paise: "150000" }]);
    expect(await rejection(confirm(owner, claim.id))).toMatch(/rejected/);
    expect(await rejection(reject(owner, claim.id, "again"))).toMatch(/already been decided/);
  });

  it("refuses a sixth pending claim from one contact", async () => {
    const { contact, student } = await owing();
    for (let i = 1; i <= 5; i++) await submit(contact, student, 1000, { reference: `UTR-${i}` });
    expect(await rejection(submit(contact, student, 1000, { reference: "UTR-6" }))).toMatch(
      /five payments are already waiting/,
    );
  });

  it("only accepts a dancer who belongs to the contact", async () => {
    const { contact } = await owing();
    const other = await owing();
    expect(await rejection(submit(contact, other.student, 1000))).toMatch(/not on this link/);
  });

  it("needs a reference for UPI and bank, not for cash, and refuses a future date", async () => {
    const { contact, student } = await owing();
    expect(await rejection(submit(contact, student, 1000, { reference: null }))).toMatch(
      /reference number/,
    );
    expect(
      await rejection(submit(contact, student, 1000, { method: "bank", reference: "  " })),
    ).toMatch(/reference number/);
    expect((await submit(contact, student, 1000, { method: "cash", reference: null })).status).toBe(
      "pending",
    );
    expect(await rejection(submit(contact, student, 1000, { paidOn: "2099-01-01" }))).toMatch(
      /future/,
    );
  });

  it("another studio's owner cannot read or decide this studio's claims", async () => {
    const { owner, contact, student } = await owing();
    const claim = await submit(contact, student, 150000);
    const stranger = await newStudio(db);
    expect(await queue(stranger)).toEqual([]);
    expect(await rejection(confirm(stranger, claim.id))).toMatch(/claim not found/);
    expect(await rejection(reject(stranger, claim.id, "no"))).toMatch(/claim not found/);
    expect(await queue(owner)).toHaveLength(1);
  });

  it("is not available to anonymous callers, and owners cannot submit claims or edit them directly", async () => {
    const { owner, contact, student } = await owing();
    expect(await rejection(db.query("anon", "SELECT * FROM public.payment_claim_queue()"))).toMatch(
      /permission denied/i,
    );
    expect(
      await rejection(
        db.query(
          { user: owner },
          "SELECT * FROM public.submit_payment_claim($1, $2, 1000, 'cash', '2026-10-06'::date, NULL)",
          [contact, student],
        ),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await rejection(
        db.query({ user: owner }, "UPDATE public.payment_claims SET status = 'confirmed'"),
      ),
    ).toMatch(/permission denied/i);
  });

  it("lists screenshots to purge for decided claims and stale pending claims only", async () => {
    const { owner, contact, student } = await owing();
    const decided = await submit(contact, student, 1000, { reference: "UTR-A" });
    const fresh = await submit(contact, student, 1000, { reference: "UTR-B" });
    const stale = await submit(contact, student, 1000, { reference: "UTR-C" });
    await db.admin(
      "UPDATE public.payment_claims SET screenshot_path = 'x/' || id::text WHERE studio_id = $1",
      [owner],
    );
    await reject(owner, decided.id, "not found");
    await db.admin(
      "UPDATE public.payment_claims SET created_at = now() - interval '31 days' WHERE id = $1",
      [stale.id],
    );
    const rows = await db.query<{ claim_id: string }>(
      "service",
      "SELECT claim_id FROM public.claim_screenshots_to_purge(30)",
    );
    expect(rows.map((r) => r.claim_id).sort()).toEqual([decided.id, stale.id].sort());
    expect(rows.map((r) => r.claim_id)).not.toContain(fresh.id);
  });
});
