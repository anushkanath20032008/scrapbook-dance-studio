// @vitest-environment node
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newBatch, newGuardian, newStudent, newStudio, payment } from "./fixtures";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const TOKEN = (n: number) => `${String(n).padStart(2, "0")}`.repeat(1).padEnd(43, "t");
const CODE = (n: number) => `ABCD${String(1000 + n)}`;

describe("instructor access", () => {
  let db: TestDb;
  let counter = 0;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  /** Invite and accept: returns the new instructor's user id. */
  async function addInstructor(owner: string, email?: string) {
    const n = ++counter;
    const user = await db.addUser(email ?? `teacher-${n}@example.com`);
    await db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite($1, 7, $2, $3)", [
      email ?? null,
      sha(TOKEN(n)),
      sha(CODE(n)),
    ]);
    const redeemed = await db.query<{ redeem_instructor_invite: string | null }>(
      { user },
      "SELECT public.redeem_instructor_invite($1)",
      [TOKEN(n)],
    );
    expect(redeemed[0].redeem_instructor_invite).not.toBeNull();
    return user;
  }

  async function studioWithClass() {
    const owner = await newStudio(db, "Natya");
    const batch = await newBatch(db, owner, "Beginners");
    const asha = await newStudent(db, owner, "Asha", { amountPaise: 150000 });
    const guardian = await newGuardian(db, owner, "Asha");
    await db.admin("UPDATE public.students SET guardian_id = $2 WHERE id = $1", [asha.id, guardian]);
    await db.admin("INSERT INTO public.batch_members (studio_id, batch_id, student_id, joined_on) VALUES ($1, $2, $3, DATE '2026-01-01')", [owner, batch, asha.id]);
    await payment(db, owner, asha.id, 50000);
    return { owner, batch, asha };
  }

  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  it("lets an instructor see the batches and dancer names, and mark and view attendance", async () => {
    const { owner, batch, asha } = await studioWithClass();
    const teacher = await addInstructor(owner);

    expect(await db.query({ user: teacher }, "SELECT studio_name FROM public.instructor_me()")).toEqual([{ studio_name: "Natya" }]);
    expect((await db.query<{ name: string }>({ user: teacher }, "SELECT name FROM public.instructor_batches()")).map((r) => r.name)).toEqual(["Beginners"]);
    expect(await db.query({ user: teacher }, "SELECT * FROM public.instructor_batch_roster($1)", [batch])).toEqual([
      { student_id: asha.id, student_name: "Asha" },
    ]);

    const marks = JSON.stringify([{ student_id: asha.id, present: true }]);
    const marked = await db.query<{ n: number }>({ user: teacher }, "SELECT public.instructor_mark_attendance($1, $2::date, $3::jsonb) AS n", [batch, today(), marks]);
    expect(marked[0].n).toBe(1);
    expect(await db.query({ user: teacher }, "SELECT student_name, present FROM public.instructor_batch_day($1, $2::date)", [batch, today()])).toEqual([
      { student_name: "Asha", present: true },
    ]);
    // The owner sees the instructor's mark.
    expect(await db.query({ user: owner }, "SELECT present FROM public.batch_day($1, $2::date)", [batch, today()])).toEqual([{ present: true }]);
  });

  it("refuses an instructor on every money, contact and account table", async () => {
    const { owner, asha } = await studioWithClass();
    const teacher = await addInstructor(owner);
    const tables = [
      "students", "guardians", "batches", "batch_members", "fee_plans", "fee_plan_assignments", "charges", "payments",
      "payment_claims", "reminders", "family_links", "class_sessions", "attendance_records", "studio_profiles",
      "billing_events", "member_invites", "member_links", "studio_instructors", "telegram_links", "invite_attempts",
    ];
    for (const table of tables) {
      // Either no privilege at all, or a row policy that shows an instructor nothing.
      let seen: number;
      try {
        seen = (await db.query({ user: teacher }, `SELECT * FROM public.${table}`)).length;
      } catch (error) {
        expect(String(error), table).toMatch(/permission denied/i);
        seen = 0;
      }
      expect(seen, table).toBe(0);
    }
    expect(await rejection(db.query({ user: teacher }, "UPDATE public.studio_profiles SET plan = 'pro'"))).toMatch(/permission denied/i);
    expect(await rejection(db.query({ user: teacher }, "INSERT INTO public.payments (studio_id, student_id, amount_paise, method, paid_on, idempotency_key) VALUES ($1, $2, 1, 'cash', DATE '2026-10-01', 'x')", [owner, asha.id]))).toMatch(/permission denied|row-level security/i);
    // An instructor cannot remove themselves or anyone else: the row policy matches no row.
    await db.query({ user: teacher }, "UPDATE public.studio_instructors SET revoked_at = now()");
    expect(await db.admin("SELECT 1 FROM public.studio_instructors WHERE studio_id = $1 AND revoked_at IS NOT NULL", [owner])).toEqual([]);
  });

  it("refuses an instructor on the owner's money functions", async () => {
    const { owner, asha } = await studioWithClass();
    const teacher = await addInstructor(owner);
    const attempts = [
      ["SELECT * FROM public.ledger_overview(DATE '2026-10-01')", []],
      ["SELECT * FROM public.unpaid_students(DATE '2026-10-01')", []],
      ["SELECT public.generate_monthly_charges(DATE '2026-10-01')", []],
      ["SELECT public.record_payment($1, 100, 'cash', DATE '2026-10-06', 'k')", [asha.id]],
      ["SELECT * FROM public.payment_claim_queue()", []],
      ["SELECT * FROM public.studio_snapshot(DATE '2026-10-01')", []],
    ] as const;
    for (const [sql, params] of attempts) {
      let outcome: "empty" | "refused" | "leak";
      try {
        const rows = await db.query({ user: teacher }, sql, [...params]);
        // An aggregate may answer with a row of zeros; any real figure or name is a leak.
        const figures = JSON.stringify(rows).match(/\d+/g) ?? [];
        outcome = figures.every((figure) => Number(figure) === 0) ? "empty" : "leak";
        if (outcome === "leak") console.log(sql, JSON.stringify(rows));
      } catch {
        outcome = "refused";
      }
      expect(["empty", "refused"], sql).toContain(outcome);
    }
    // Nothing was written for the studio.
    const [{ n }] = await db.admin<{ n: string }>("SELECT count(*)::text AS n FROM public.payments WHERE studio_id = $1", [owner]);
    expect(n).toBe("1");
  });

  it("keeps an instructor out of other studios", async () => {
    const mine = await studioWithClass();
    const theirs = await studioWithClass();
    const teacher = await addInstructor(mine.owner);

    expect(await db.query({ user: teacher }, "SELECT * FROM public.instructor_batch_roster($1)", [theirs.batch])).toEqual([]);
    expect(await db.query({ user: teacher }, "SELECT * FROM public.instructor_batch_day($1, $2::date)", [theirs.batch, today()])).toEqual([]);
    const marks = JSON.stringify([{ student_id: theirs.asha.id, present: true }]);
    expect(await rejection(db.query({ user: teacher }, "SELECT public.instructor_mark_attendance($1, $2::date, $3::jsonb)", [theirs.batch, today(), marks]))).toMatch(/batch not found/);
    // A dancer from the other studio cannot be marked on this studio's batch either.
    expect(await rejection(db.query({ user: teacher }, "SELECT public.instructor_mark_attendance($1, $2::date, $3::jsonb)", [mine.batch, today(), marks]))).toMatch(/not on the roster/);
    expect(await db.admin("SELECT 1 FROM public.attendance_records WHERE studio_id = $1", [theirs.owner])).toEqual([]);
    const names = (await db.query<{ name: string }>({ user: teacher }, "SELECT name FROM public.instructor_batches()")).length;
    expect(names).toBe(1);
  });

  it("gives a user who is not an instructor nothing, and cannot be tricked by a stranger's owner id", async () => {
    const { owner, batch } = await studioWithClass();
    const stranger = await db.addUser();
    expect(await db.query({ user: stranger }, "SELECT * FROM public.instructor_me()")).toEqual([]);
    expect(await db.query({ user: stranger }, "SELECT * FROM public.instructor_batches()")).toEqual([]);
    expect(await db.query({ user: stranger }, "SELECT * FROM public.instructor_batch_roster($1)", [batch])).toEqual([]);
    expect(await db.query({ user: owner }, "SELECT * FROM public.instructor_batches()")).toEqual([]);
    expect(await rejection(db.query("anon", "SELECT * FROM public.instructor_batches()"))).toMatch(/permission denied/i);
    expect(await rejection(db.query("anon", "SELECT public.redeem_instructor_invite('x')"))).toMatch(/permission denied/i);
  });

  it("stops everything the moment the owner removes the instructor", async () => {
    const { owner, batch } = await studioWithClass();
    const teacher = await addInstructor(owner);
    const [row] = await db.query<{ id: string }>({ user: owner }, "SELECT id FROM public.studio_instructors");
    await db.query({ user: owner }, "UPDATE public.studio_instructors SET revoked_at = now() WHERE id = $1", [row.id]);
    expect(await db.query({ user: teacher }, "SELECT * FROM public.instructor_me()")).toEqual([]);
    expect(await db.query({ user: teacher }, "SELECT * FROM public.instructor_batches()")).toEqual([]);
    expect(await db.query({ user: teacher }, "SELECT * FROM public.instructor_batch_roster($1)", [batch])).toEqual([]);
    // A removal cannot be undone.
    expect(await rejection(db.query({ user: owner }, "UPDATE public.studio_instructors SET revoked_at = NULL WHERE id = $1", [row.id]))).toMatch(/revoked/);
  });

  it("lets the owner see status only: never the secrets or the account id, and never another studio's team", async () => {
    const a = await newStudio(db);
    const b = await newStudio(db);
    await addInstructor(a, "one@example.com");
    expect((await db.query<{ email: string }>({ user: a }, "SELECT email FROM public.studio_instructors")).map((r) => r.email)).toEqual(["one@example.com"]);
    expect(await db.query({ user: b }, "SELECT email FROM public.studio_instructors")).toEqual([]);
    expect(await rejection(db.query({ user: a }, "SELECT token_hash FROM public.studio_instructors"))).toMatch(/permission denied/i);
    expect(await rejection(db.query({ user: a }, "SELECT user_id FROM public.studio_instructors"))).toMatch(/permission denied/i);
    // Studio b cannot remove studio a's instructor.
    await db.query({ user: b }, "UPDATE public.studio_instructors SET revoked_at = now()");
    expect(await db.admin("SELECT 1 FROM public.studio_instructors WHERE studio_id = $1 AND revoked_at IS NOT NULL", [a])).toEqual([]);
  });

  describe("invites", () => {
    it("works once, by link or by code, and only for the invited email when one is given", async () => {
      const owner = await newStudio(db);
      const n = ++counter;
      await db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite($1, 7, $2, $3)", ["Sam@Example.com ", sha(TOKEN(n)), sha(CODE(n))]);
      const wrong = await db.addUser("someone-else@example.com");
      expect((await db.query<{ r: string | null }>({ user: wrong }, "SELECT public.redeem_instructor_invite($1) AS r", [TOKEN(n)]))[0].r).toBeNull();
      const sam = await db.addUser("sam@example.com");
      const byCode = await db.query<{ r: string | null }>({ user: sam }, "SELECT public.redeem_instructor_invite($1) AS r", ["abcd-" + String(1000 + n).slice(0)]);
      expect(byCode[0].r).not.toBeNull();
      const late = await db.addUser("sam@example.com");
      expect((await db.query<{ r: string | null }>({ user: late }, "SELECT public.redeem_instructor_invite($1) AS r", [TOKEN(n)]))[0].r).toBeNull();
    });

    it("lets a link-only invite be accepted by whoever holds it, and records their email", async () => {
      const owner = await newStudio(db);
      const n = ++counter;
      await db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite(NULL, 1, $1, $2)", [sha(TOKEN(n)), sha(CODE(n))]);
      const user = await db.addUser("anyone@example.com");
      expect((await db.query<{ r: string | null }>({ user }, "SELECT public.redeem_instructor_invite($1) AS r", [TOKEN(n)]))[0].r).not.toBeNull();
      expect((await db.query<{ email: string }>({ user: owner }, "SELECT email FROM public.studio_instructors"))[0].email).toBe("anyone@example.com");
    });

    it("refuses expired and revoked invites, and invites from someone without a studio", async () => {
      const owner = await newStudio(db);
      const stranger = await db.addUser();
      expect(await rejection(db.query({ user: stranger }, "SELECT * FROM public.create_instructor_invite(NULL, 7, 'a', 'b')"))).toMatch(/only the studio owner/);
      expect(await rejection(db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite('not-an-email', 7, 'a', 'b')"))).toMatch(/email/);
      expect(await rejection(db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite(NULL, 3, 'a', 'b')"))).toMatch(/1, 7 or 30/);

      const n = ++counter;
      await db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite(NULL, 7, $1, $2)", [sha(TOKEN(n)), sha(CODE(n))]);
      await db.admin("UPDATE public.studio_instructors SET expires_at = now() - interval '1 minute' WHERE token_hash = $1", [sha(TOKEN(n))]);
      const user = await db.addUser();
      expect((await db.query<{ r: string | null }>({ user }, "SELECT public.redeem_instructor_invite($1) AS r", [TOKEN(n)]))[0].r).toBeNull();

      const m = ++counter;
      await db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite(NULL, 7, $1, $2)", [sha(TOKEN(m)), sha(CODE(m))]);
      const [pending] = await db.admin<{ id: string }>("SELECT id FROM public.studio_instructors WHERE token_hash = $1", [sha(TOKEN(m))]);
      await db.query({ user: owner }, "UPDATE public.studio_instructors SET revoked_at = now() WHERE id = $1", [pending.id]);
      const other = await db.addUser();
      expect((await db.query<{ r: string | null }>({ user: other }, "SELECT public.redeem_instructor_invite($1) AS r", [TOKEN(m)]))[0].r).toBeNull();
    });

    it("does not let a studio owner become an instructor, or an instructor start a studio", async () => {
      const owner = await newStudio(db);
      const other = await newStudio(db);
      const n = ++counter;
      await db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite(NULL, 7, $1, $2)", [sha(TOKEN(n)), sha(CODE(n))]);
      expect(await rejection(db.query({ user: other }, "SELECT public.redeem_instructor_invite($1)", [TOKEN(n)]))).toMatch(/already runs a studio/);

      const teacher = await addInstructor(owner);
      expect(await rejection(db.query({ user: teacher }, "INSERT INTO public.studio_profiles (user_id) VALUES ($1)", [teacher]))).toMatch(/permission denied|cannot run a studio/i);
      expect(await rejection(db.admin("INSERT INTO public.studio_profiles (user_id) VALUES ($1)", [teacher]))).toMatch(/cannot run a studio/);
    });

    it("throttles repeated wrong guesses", async () => {
      const user = await db.addUser();
      for (let i = 0; i < 5; i++) {
        await db.query({ user }, "SELECT public.redeem_instructor_invite($1)", [`wrong-guess-${i}`]);
      }
      const owner = await newStudio(db);
      const n = ++counter;
      await db.query({ user: owner }, "SELECT * FROM public.create_instructor_invite(NULL, 7, $1, $2)", [sha(TOKEN(n)), sha(CODE(n))]);
      expect((await db.query<{ r: string | null }>({ user }, "SELECT public.redeem_instructor_invite($1) AS r", [TOKEN(n)]))[0].r).toBeNull();
    });
  });
});
