// @vitest-environment node
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newBatch, newGuardian, newStudent, newStudio, payment } from "./fixtures";

const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

let counter = 0;
const nextToken = () => `T${String(++counter).padStart(2, "0")}${"x".repeat(40)}`; // 43 characters
const nextCode = () => `ABCD${String(1000 + ++counter)}`; // 8 characters

describe("member portal: invites, links and what a dancer can reach", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  /** An owner invites a dancer; returns the secrets the dancer would receive. */
  async function invite(owner: string, guardian: string, days = 7) {
    const token = nextToken();
    const code = nextCode();
    const [row] = await db.query<{ id: string }>(
      { user: owner },
      "SELECT id FROM public.create_member_invite($1, $2, $3, $4)",
      [guardian, days, sha(token), sha(code)],
    );
    return { id: row.id, token, code };
  }

  const redeem = async (user: string, secret: string, source: string | null = null) =>
    (
      await db.query<{ name: string | null }>(
        { user },
        "SELECT public.redeem_member_invite($1, $2) AS name",
        [secret, source],
      )
    )[0].name;

  /** A studio with one dancer who owes money, plus a second dancer, and a signed-up member for the first. */
  async function studioWithMember(label = "Hub") {
    const owner = await newStudio(db, label);
    const guardianA = await newGuardian(db, owner, `${label} Asha`);
    const guardianB = await newGuardian(db, owner, `${label} Bela`);
    const a = await newStudent(db, owner, `${label} Asha`, {
      amountPaise: 150000,
      guardian: guardianA,
    });
    const b = await newStudent(db, owner, `${label} Bela`, {
      amountPaise: 90000,
      guardian: guardianB,
    });
    await db.query(
      { user: owner },
      "SELECT public.generate_monthly_charges('2026-10-01', '2026-10-05')",
    );
    await payment(db, owner, a.id, 50000);
    const memberA = await db.addUser();
    const memberB = await db.addUser();
    const inviteA = await invite(owner, guardianA);
    const inviteB = await invite(owner, guardianB);
    expect(await redeem(memberA, inviteA.token)).toBe(label);
    expect(await redeem(memberB, inviteB.code)).toBe(label);
    return { owner, guardianA, guardianB, a, b, memberA, memberB };
  }

  describe("what a dancer can reach (AE3, AE4)", () => {
    it("shows a dancer only their own record, with the numbers the studio sees", async () => {
      const s = await studioWithMember("Reach");
      const [row] = await db.query<{ view: Record<string, unknown> }>(
        { user: s.memberA },
        "SELECT public.member_view($1) AS view",
        [s.owner],
      );
      const view = row.view as {
        studio_name: string;
        balance_paise: number;
        students: {
          id: string;
          name: string;
          balance_paise: number;
          charges: { status: string }[];
          payments: unknown[];
        }[];
      };
      expect(view.studio_name).toBe("Reach");
      expect(view.students.map((student) => student.id)).toEqual([s.a.id]);
      expect(view.balance_paise).toBe(100000);
      expect(view.students[0]?.charges[0]?.status).toBe("overdue");
      expect(view.students[0]?.payments).toHaveLength(1);

      // The studio's own ledger agrees with what the dancer sees.
      const [owner] = await db.query<{ balance_paise: string }>(
        { user: s.owner },
        "SELECT balance_paise::text FROM public.student_ledger_status('2026-10-01', '2026-10-20', ARRAY[$1]::uuid[])",
        [s.a.id],
      );
      expect(Number(owner.balance_paise)).toBe(view.balance_paise);
    });

    it("gives a member no table access at all, so another dancer's rows are unreachable", async () => {
      const s = await studioWithMember("Tables");
      for (const table of [
        "students",
        "guardians",
        "charges",
        "payments",
        "attendance_records",
        "class_sessions",
        "batches",
        "batch_members",
        "payment_claims",
        "family_links",
        "member_links",
        "member_invites",
      ]) {
        const rows = await db
          .query({ user: s.memberA }, `SELECT 1 FROM public.${table}`)
          .catch((error: Error) => error.message);
        // Either no rows (row-level security) or no privilege; never data.
        expect(Array.isArray(rows) ? rows.length : rows).toSatisfy(
          (value: unknown) => value === 0 || /permission denied/.test(String(value)),
        );
      }
    });

    it("keeps two studios apart for one account, and a stranger sees nothing", async () => {
      const x = await studioWithMember("Xylo");
      const owner2 = await newStudio(db, "Yarn");
      const guardianY = await newGuardian(db, owner2, "Asha at Yarn");
      await newStudent(db, owner2, "Asha at Yarn", { amountPaise: 70000, guardian: guardianY });
      const inviteY = await invite(owner2, guardianY);
      expect(await redeem(x.memberA, inviteY.token)).toBe("Yarn");

      const studios = await db.query<{ studio_name: string }>(
        { user: x.memberA },
        "SELECT studio_name FROM public.member_studios()",
      );
      expect(studios.map((studio) => studio.studio_name)).toEqual(["Xylo", "Yarn"]);

      const viewOf = async (user: string, studio: string) =>
        (
          await db.query<{ view: { students: { name: string }[] } | null }>(
            { user },
            "SELECT public.member_view($1) AS view",
            [studio],
          )
        )[0].view;
      expect((await viewOf(x.memberA, x.owner))?.students.map((st) => st.name)).toEqual([
        "Xylo Asha",
      ]);
      expect((await viewOf(x.memberA, owner2))?.students.map((st) => st.name)).toEqual([
        "Asha at Yarn",
      ]);
      // Another account that belongs only to Xylo cannot read Yarn, and a stranger reads neither.
      expect(await viewOf(x.memberB, owner2)).toBeNull();
      const stranger = await db.addUser();
      expect(await viewOf(stranger, x.owner)).toBeNull();
      expect(
        await db.query({ user: stranger }, "SELECT * FROM public.member_studios()"),
      ).toHaveLength(0);
    });

    it("stops everything the moment the studio removes access (AE5)", async () => {
      const s = await studioWithMember("Remove");
      const [link] = await db.query<{ id: string }>(
        { user: s.owner },
        "SELECT id FROM public.member_links WHERE guardian_id = $1",
        [s.guardianA],
      );
      await db.query(
        { user: s.owner },
        "UPDATE public.member_links SET revoked_at = now() WHERE id = $1",
        [link.id],
      );
      const [view] = await db.query<{ view: unknown }>(
        { user: s.memberA },
        "SELECT public.member_view($1) AS view",
        [s.owner],
      );
      expect(view.view).toBeNull();
      expect(
        await db.query({ user: s.memberA }, "SELECT * FROM public.member_studios()"),
      ).toHaveLength(0);
      expect(
        await db.query({ user: s.memberA }, "SELECT * FROM public.member_claims($1)", [s.owner]),
      ).toHaveLength(0);
      // The revoked membership cannot be restored, and the old invite cannot be used again.
      expect(
        await rejection(
          db.query(
            { user: s.owner },
            "UPDATE public.member_links SET revoked_at = NULL WHERE id = $1",
            [link.id],
          ),
        ),
      ).toMatch(/cannot be restored/);
      // A dancer whose record is archived disappears from the member's view too.
      const s2 = await studioWithMember("Archive");
      await db.admin("UPDATE public.guardians SET archived_at = now() WHERE id = $1", [
        s2.guardianA,
      ]);
      const [archived] = await db.query<{ view: unknown }>(
        { user: s2.memberA },
        "SELECT public.member_view($1) AS view",
        [s2.owner],
      );
      expect(archived.view).toBeNull();
    });

    it("gives a dancer with no classes or charges an empty but valid view", async () => {
      const owner = await newStudio(db, "Fresh");
      const guardian = await newGuardian(db, owner, "New dancer");
      await newStudent(db, owner, "New dancer", { guardian });
      const member = await db.addUser();
      await redeem(member, (await invite(owner, guardian)).token);
      const [row] = await db.query<{
        view: { balance_paise: number; students: { batches: unknown[]; charges: unknown[] }[] };
      }>({ user: member }, "SELECT public.member_view($1) AS view", [owner]);
      expect(row.view.balance_paise).toBe(0);
      expect(row.view.students[0]).toMatchObject({ batches: [], charges: [] });
    });

    it("hides archived students and ended batches", async () => {
      const owner = await newStudio(db, "Quiet");
      const guardian = await newGuardian(db, owner, "Two records");
      const kept = await newStudent(db, owner, "Kept", { guardian });
      const gone = await newStudent(db, owner, "Gone", { guardian });
      await db.admin("UPDATE public.students SET archived_at = now() WHERE id = $1", [gone.id]);
      const batch = await newBatch(db, owner, "Old batch");
      await db.admin(
        "INSERT INTO public.batch_members (studio_id, batch_id, student_id, joined_on, left_on) VALUES ($1, $2, $3, '2026-01-01', '2026-02-01')",
        [owner, batch, kept.id],
      );
      const member = await db.addUser();
      await redeem(member, (await invite(owner, guardian)).token);
      const [row] = await db.query<{ view: { students: { name: string; batches: unknown[] }[] } }>(
        { user: member },
        "SELECT public.member_view($1) AS view",
        [owner],
      );
      expect(row.view.students).toHaveLength(1);
      expect(row.view.students[0]).toMatchObject({ name: "Kept", batches: [] });
    });
  });

  describe("invites (AE1, AE2, AE8)", () => {
    it("gives the same answer for expired, revoked, reused, unknown and malformed invites", async () => {
      const owner = await newStudio(db, "Invites");
      const guardian = await newGuardian(db, owner, "Dancer");
      const member = await db.addUser();

      const expired = await invite(owner, guardian);
      await db.admin(
        "UPDATE public.member_invites SET expires_at = now() - interval '1 day' WHERE id = $1",
        [expired.id],
      );
      const revoked = await invite(owner, guardian);
      await db.query(
        { user: owner },
        "UPDATE public.member_invites SET revoked_at = now() WHERE id = $1",
        [revoked.id],
      );

      for (const secret of [
        expired.token,
        expired.code,
        revoked.token,
        "not-an-invite",
        "",
        "ZZZZZZZZ",
        "x".repeat(43),
      ]) {
        expect(await redeem(member, secret, `src-${secret.slice(0, 4)}`)).toBeNull();
      }
    });

    it("lets the first of two accounts win and gives the second the generic answer (AE2)", async () => {
      const owner = await newStudio(db, "Race");
      const guardian = await newGuardian(db, owner, "Dancer");
      const first = await db.addUser();
      const second = await db.addUser();
      const sent = await invite(owner, guardian);
      const results = await Promise.all([redeem(first, sent.token), redeem(second, sent.token)]);
      expect(results.filter((name) => name === "Race")).toHaveLength(1);
      expect(results.filter((name) => name === null)).toHaveLength(1);
    });

    it("accepts the short code in any case, with or without a dash", async () => {
      const owner = await newStudio(db, "Codes");
      const guardian = await newGuardian(db, owner, "Dancer");
      const member = await db.addUser();
      const sent = await invite(owner, guardian);
      const spaced = `${sent.code.slice(0, 4)}-${sent.code.slice(4)}`.toLowerCase();
      expect(await redeem(member, ` ${spaced} `)).toBe("Codes");
    });

    it("refuses a redemption once the invite's dancer is archived", async () => {
      const owner = await newStudio(db, "Archived invite");
      const guardian = await newGuardian(db, owner, "Dancer");
      const sent = await invite(owner, guardian);
      await db.admin("UPDATE public.guardians SET archived_at = now() WHERE id = $1", [guardian]);
      expect(await redeem(await db.addUser(), sent.token)).toBeNull();
    });

    it("throttles the sixth failed attempt in a minute, even with the right code (AE8)", async () => {
      const owner = await newStudio(db, "Throttle");
      const guardian = await newGuardian(db, owner, "Dancer");
      const guesser = await db.addUser();
      const sent = await invite(owner, guardian);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect(await redeem(guesser, `WRONG00${attempt}`, "same-source")).toBeNull();
      }
      expect(await redeem(guesser, sent.token, "same-source")).toBeNull();
      // A different account from a different source is not caught by that throttle.
      expect(await redeem(await db.addUser(), sent.token, "other-source")).toBe("Throttle");
    });

    it("throttles a source across accounts", async () => {
      const owner = await newStudio(db, "Source");
      const guardian = await newGuardian(db, owner, "Dancer");
      const sent = await invite(owner, guardian);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect(await redeem(await db.addUser(), `WRONG10${attempt}`, "shared-source")).toBeNull();
      }
      expect(await redeem(await db.addUser(), sent.token, "shared-source")).toBeNull();
    });

    it("replaces the older pending invite when a new one is issued", async () => {
      const owner = await newStudio(db, "Reissue");
      const guardian = await newGuardian(db, owner, "Dancer");
      const older = await invite(owner, guardian);
      const newer = await invite(owner, guardian);
      expect(await redeem(await db.addUser(), older.token)).toBeNull();
      expect(await redeem(await db.addUser(), newer.token)).toBe("Reissue");
    });

    it("refuses an invite for a dancer who already has a login, or for another studio's dancer", async () => {
      const s = await studioWithMember("Dup");
      expect(
        await rejection(
          db.query(
            { user: s.owner },
            "SELECT * FROM public.create_member_invite($1, 7, 'h1', 'h2')",
            [s.guardianA],
          ),
        ),
      ).toMatch(/already has a login/);
      const other = await newStudio(db, "Other");
      expect(
        await rejection(
          db.query(
            { user: other },
            "SELECT * FROM public.create_member_invite($1, 7, 'h3', 'h4')",
            [s.guardianB],
          ),
        ),
      ).toMatch(/dancer was not found/);
      expect(
        await rejection(
          db.query(
            { user: s.owner },
            "SELECT * FROM public.create_member_invite($1, 3, 'h5', 'h6')",
            [s.guardianB],
          ),
        ),
      ).toMatch(/1, 7 or 30/);
    });

    it("keeps the owner's studio profile intact when an owner also redeems an invite (AE6)", async () => {
      const hub = await newStudio(db, "Hub owner");
      const guest = await newStudio(db, "Guest owner");
      const guardian = await newGuardian(db, guest, "Visiting owner");
      expect(await redeem(hub, (await invite(guest, guardian)).token)).toBe("Guest owner");
      const profiles = await db.admin(
        "SELECT user_id FROM public.studio_profiles WHERE user_id = $1",
        [hub],
      );
      expect(profiles).toHaveLength(1);
      // A member-only account has no profile and none is created by redeeming.
      const memberOnly = await db.addUser();
      await redeem(
        memberOnly,
        (await invite(guest, await newGuardian(db, guest, "Member only"))).token,
      );
      expect(
        await db.admin("SELECT 1 FROM public.studio_profiles WHERE user_id = $1", [memberOnly]),
      ).toHaveLength(0);
    });
  });

  describe("what the owner sees and can change", () => {
    it("shows status without hashes, and hides invites and links from other studios", async () => {
      const s = await studioWithMember("Owner view");
      const stranger = await newStudio(db, "Neighbour");
      expect(
        await rejection(
          db.query({ user: s.owner }, "SELECT token_hash FROM public.member_invites"),
        ),
      ).toMatch(/permission denied/);
      expect(
        await rejection(db.query({ user: s.owner }, "SELECT user_id FROM public.member_links")),
      ).toMatch(/permission denied/);
      const rows = await db.query<{ redeemed_at: string | null }>(
        { user: s.owner },
        "SELECT redeemed_at FROM public.member_invites WHERE guardian_id = $1",
        [s.guardianA],
      );
      expect(rows[0].redeemed_at).not.toBeNull();
      expect(
        await db.query({ user: stranger }, "SELECT id FROM public.member_invites"),
      ).toHaveLength(0);
      expect(await db.query({ user: stranger }, "SELECT id FROM public.member_links")).toHaveLength(
        0,
      );
      // Another studio cannot revoke this studio's links.
      await db.query({ user: stranger }, "UPDATE public.member_links SET revoked_at = now()");
      expect(
        await db.admin(
          "SELECT 1 FROM public.member_links WHERE studio_id = $1 AND revoked_at IS NOT NULL",
          [s.owner],
        ),
      ).toHaveLength(0);
    });

    it("lets no one but the server write invites or links directly", async () => {
      const s = await studioWithMember("No direct");
      const writes: [string, unknown[]][] = [
        [
          "INSERT INTO public.member_links (user_id, studio_id, guardian_id) VALUES ($1, $2, $3)",
          [s.memberA, s.owner, s.guardianB],
        ],
        [
          "INSERT INTO public.member_invites (studio_id, guardian_id, token_hash, code_hash, expires_at) VALUES ($1, $2, 'a', 'b', now())",
          [s.owner, s.guardianB],
        ],
      ];
      for (const [sql, params] of writes) {
        for (const actor of [{ user: s.owner }, { user: s.memberA }] as const) {
          expect(await rejection(db.query(actor, sql, params))).toMatch(
            /permission denied|row-level/,
          );
        }
      }
      expect(await rejection(db.query("anon", "SELECT * FROM public.member_studios()"))).toMatch(
        /permission denied/,
      );
      expect(
        await rejection(
          db.query({ user: s.owner }, "UPDATE public.member_links SET user_id = gen_random_uuid()"),
        ),
      ).toMatch(/permission denied/);
    });
  });

  describe("claims from a member (AE7)", () => {
    const claim = (
      user: string,
      studio: string,
      student: string,
      amount = 150000,
      reference: string | null = "UTR-M1",
    ) =>
      db.query<{ id: string; status: string; submitted_via: string }>(
        { user },
        "SELECT id, status, submitted_via FROM public.submit_payment_claim_member($1, $2, $3, 'upi', '2026-10-06', $4)",
        [studio, student, amount, reference],
      );

    it("records a pending claim for the member's own dancer and changes no balance", async () => {
      const s = await studioWithMember("Claims");
      const before = await db.query<{ view: { balance_paise: number } }>(
        { user: s.memberA },
        "SELECT public.member_view($1) AS view",
        [s.owner],
      );
      const [made] = await claim(s.memberA, s.owner, s.a.id, 100000, "UTR-OWN");
      expect(made).toMatchObject({ status: "pending", submitted_via: "member" });
      const after = await db.query<{ view: { balance_paise: number } }>(
        { user: s.memberA },
        "SELECT public.member_view($1) AS view",
        [s.owner],
      );
      expect(after[0].view.balance_paise).toBe(before[0].view.balance_paise);
      const mine = await db.query<{ id: string }>(
        { user: s.memberA },
        "SELECT id FROM public.member_claims($1)",
        [s.owner],
      );
      expect(mine.map((row) => row.id)).toEqual([made.id]);
      // The owner sees it in To verify like any other claim.
      const queue = await db.query<{ claim_id: string }>(
        { user: s.owner },
        "SELECT claim_id FROM public.payment_claim_queue()",
      );
      expect(queue.map((row) => row.claim_id)).toContain(made.id);
    });

    it("refuses a claim for another dancer's record, another studio, or without a membership", async () => {
      const s = await studioWithMember("Claims2");
      expect(await rejection(claim(s.memberA, s.owner, s.b.id))).toMatch(/not on your account/);
      const stranger = await db.addUser();
      expect(await rejection(claim(stranger, s.owner, s.a.id))).toMatch(/not on your account/);
      const other = await studioWithMember("Claims3");
      expect(await rejection(claim(s.memberA, other.owner, other.a.id))).toMatch(
        /not on your account/,
      );
    });

    it("shows a member only their own claims, with the owner's reason when rejected", async () => {
      const s = await studioWithMember("Claims4");
      const [mine] = await claim(s.memberA, s.owner, s.a.id, 5000, "UTR-A");
      const [theirs] = await claim(s.memberB, s.owner, s.b.id, 5000, "UTR-B");
      await db.query(
        { user: s.owner },
        "SELECT public.reject_payment_claim($1, 'Reference not found')",
        [mine.id],
      );
      const seenByA = await db.query<{
        id: string;
        status: string;
        decision_reason: string | null;
      }>({ user: s.memberA }, "SELECT id, status, decision_reason FROM public.member_claims($1)", [
        s.owner,
      ]);
      expect(seenByA).toEqual([
        { id: mine.id, status: "rejected", decision_reason: "Reference not found" },
      ]);
      expect(seenByA.map((row) => row.id)).not.toContain(theirs.id);
    });

    it("counts one cap of five waiting claims across the link and the account", async () => {
      const s = await studioWithMember("Claims5");
      for (let i = 0; i < 3; i += 1)
        await claim(s.memberA, s.owner, s.a.id, 1000 + i, `UTR-CAP-${i}`);
      for (let i = 0; i < 2; i += 1) {
        await db.query(
          "service",
          "SELECT * FROM public.submit_payment_claim($1, $2, 1000, 'cash', '2026-10-06')",
          [s.guardianA, s.a.id],
        );
      }
      expect(await rejection(claim(s.memberA, s.owner, s.a.id, 1000, "UTR-CAP-9"))).toMatch(
        /five payments are already waiting/,
      );
    });

    it("cannot be called by anonymous callers", async () => {
      const s = await studioWithMember("Claims6");
      expect(
        await rejection(
          db.query(
            "anon",
            "SELECT * FROM public.submit_payment_claim_member($1, $2, 100, 'cash', '2026-10-06')",
            [s.owner, s.a.id],
          ),
        ),
      ).toMatch(/permission denied/);
    });
  });
});
