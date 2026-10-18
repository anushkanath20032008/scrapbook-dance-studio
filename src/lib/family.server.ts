import { createHash, randomBytes } from "node:crypto";
import { friendlyError, unwrap, type Db, type StudioContext } from "./studio.server";

/** Like unwrap, but a missing row is a normal answer (null) rather than an error. */
function maybe<T>(result: { data: T; error: { code?: string; message?: string } | null }): T {
  if (result.error) throw friendlyError(result.error);
  return result.data;
}

const TOKEN_BYTES = 32;
const NOT_FOUND = "This link is not valid. Ask your studio for a new one.";

export const hashToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

/** An unguessable token: 32 random bytes, URL-safe. Only its hash is ever stored. */
export const newToken = () => randomBytes(TOKEN_BYTES).toString("base64url");

const tokenShape = /^[A-Za-z0-9_-]{43}$/;

export async function createFamilyLink(
  { supabase, userId }: StudioContext,
  input: { guardianId: string },
  baseUrl: string,
) {
  const token = newToken();
  unwrap(
    await supabase
      .from("family_links")
      .insert({ studio_id: userId, guardian_id: input.guardianId, token_hash: hashToken(token) })
      .select("id")
      .single(),
  );
  // The full link is returned once; afterwards only its hash exists.
  return { url: `${baseUrl.replace(/\/+$/, "")}/family/${token}` };
}

export async function listFamilyLinks(
  { supabase }: StudioContext,
  input: { guardianId?: string | undefined },
) {
  let query = supabase
    .from("family_links")
    .select("id, guardian_id, revoked_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (input.guardianId) query = query.eq("guardian_id", input.guardianId);
  return unwrap(await query);
}

export async function revokeFamilyLink({ supabase }: StudioContext, input: { id: string }) {
  const row = maybe(
    await supabase
      .from("family_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", input.id)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle(),
  );
  if (!row) throw new Error("That link was not found or is already revoked.");
  return { revoked: true };
}

export type FamilyStudent = {
  id: string;
  name: string;
  balance_paise: number;
  batches: {
    name: string;
    weekdays: number[];
    starts_at: string | null;
    ends_at: string | null;
    trainer_name: string | null;
    room: string | null;
  }[];
  attendance: { date: string | null; present: boolean }[];
  charges: { period: string; due_on: string; amount_paise: number; plan: string; status: string }[];
  payments: { amount_paise: number; method: string; paid_on: string }[];
};

/** The fixed shape behind the family link and the member portal. */
export type FamilyView = {
  studio_name: string | null;
  guardian_name: string | null;
  students: FamilyStudent[];
  balance_paise: number;
};

type Status = {
  student_id: string;
  charge_id: string;
  status: string;
  outstanding_paise: number;
  allocated_paise: number;
};

/**
 * The public view behind a family link. Reads with the service role but only ever for the guardian and
 * studio the link names, and returns a fixed set of fields. Any unknown, malformed or revoked token gets
 * the same answer.
 */
export async function getFamilyView(admin: Db, token: string) {
  if (!tokenShape.test(token)) throw new Error(NOT_FOUND);

  const link = maybe(
    await admin
      .from("family_links")
      .select("studio_id, guardian_id")
      .eq("token_hash", hashToken(token))
      .is("revoked_at", null)
      .maybeSingle(),
  );
  if (!link) throw new Error(NOT_FOUND);

  const [studio, guardian, students] = await Promise.all([
    admin.from("studio_profiles").select("studio_name").eq("user_id", link.studio_id).maybeSingle(),
    admin
      .from("guardians")
      .select("name")
      .eq("id", link.guardian_id)
      .eq("studio_id", link.studio_id)
      .maybeSingle(),
    admin
      .from("students")
      .select("id, name")
      .eq("studio_id", link.studio_id)
      .eq("guardian_id", link.guardian_id)
      .is("archived_at", null)
      .order("name"),
  ]);
  const studentRows = unwrap(students);
  const studentIds = studentRows.map((student) => student.id);

  const empty = {
    studio_name: maybe(studio)?.studio_name ?? null,
    guardian_name: maybe(guardian)?.name ?? null,
    students: [] as FamilyStudent[],
    balance_paise: 0,
  };
  if (studentIds.length === 0) return empty;

  const [members, sessions, charges, payments] = await Promise.all([
    admin
      .from("batch_members")
      .select("student_id, batch_id")
      .eq("studio_id", link.studio_id)
      .in("student_id", studentIds)
      .is("left_on", null),
    admin
      .from("attendance_records")
      .select("student_id, present, session_id")
      .eq("studio_id", link.studio_id)
      .in("student_id", studentIds)
      .order("marked_at", { ascending: false })
      .limit(60),
    admin
      .from("charges")
      .select("id, student_id, period, due_on, amount_paise, fee_plan_name")
      .eq("studio_id", link.studio_id)
      .in("student_id", studentIds)
      .is("voided_at", null)
      .order("period", { ascending: false }),
    admin
      .from("payments")
      .select("id, student_id, amount_paise, method, paid_on")
      .eq("studio_id", link.studio_id)
      .in("student_id", studentIds)
      .is("voided_at", null)
      .order("paid_on", { ascending: false }),
  ]);
  const chargeRows = unwrap(charges);
  const paymentRows = unwrap(payments);

  // Status comes from the same SQL function the studio sees, so both sides show the same numbers.
  const SHOWN = 24;
  const periods = [...new Set(chargeRows.slice(0, SHOWN).map((charge) => charge.period))];
  const statuses = new Map<string, Status>();
  for (const result of await Promise.all(
    periods.map((period) =>
      admin.rpc("student_ledger_status", { p_period: period, p_student_ids: studentIds }),
    ),
  )) {
    for (const row of unwrap(result)) statuses.set(row.charge_id, row);
  }

  const memberRows = unwrap(members);
  const sessionRows = unwrap(sessions);
  const batchIds = [...new Set(memberRows.map((member) => member.batch_id))];
  const sessionIds = [...new Set(sessionRows.map((record) => record.session_id))];
  const [batches, classSessions] = await Promise.all([
    batchIds.length
      ? admin
          .from("batches")
          .select("id, name, weekdays, starts_at, ends_at, trainer_name, room")
          .eq("studio_id", link.studio_id)
          .in("id", batchIds)
          .is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length
      ? admin
          .from("class_sessions")
          .select("id, session_on")
          .eq("studio_id", link.studio_id)
          .in("id", sessionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const batchById = new Map(unwrap(batches).map((batch) => [batch.id, batch]));
  const dateBySession = new Map(
    unwrap(classSessions).map((session) => [session.id, session.session_on]),
  );

  let balance = 0;
  const perStudent = studentRows.map((student) => {
    const studentCharges = chargeRows.filter((charge) => charge.student_id === student.id);
    const studentPayments = paymentRows.filter((payment) => payment.student_id === student.id);
    const owed =
      studentCharges.reduce((sum, charge) => sum + charge.amount_paise, 0) -
      studentPayments.reduce((sum, payment) => sum + payment.amount_paise, 0);
    balance += owed;
    return {
      id: student.id,
      name: student.name,
      balance_paise: owed,
      batches: memberRows
        .filter((member) => member.student_id === student.id)
        .flatMap((member) => {
          const batch = batchById.get(member.batch_id);
          return batch
            ? [
                {
                  name: batch.name,
                  weekdays: batch.weekdays,
                  starts_at: batch.starts_at,
                  ends_at: batch.ends_at,
                  trainer_name: batch.trainer_name,
                  room: batch.room,
                },
              ]
            : [];
        }),
      attendance: sessionRows
        .filter((record) => record.student_id === student.id)
        .map((record) => ({
          date: dateBySession.get(record.session_id) ?? null,
          present: record.present,
        })),
      // The balance above counts every entry; only the newest are listed.
      charges: studentCharges.slice(0, SHOWN).map((charge) => ({
        period: charge.period,
        due_on: charge.due_on,
        amount_paise: charge.amount_paise,
        plan: charge.fee_plan_name,
        status: statuses.get(charge.id)?.status ?? "due",
      })),
      payments: studentPayments.slice(0, SHOWN).map((payment) => ({
        amount_paise: payment.amount_paise,
        method: payment.method,
        paid_on: payment.paid_on,
      })),
    };
  });

  return { ...empty, students: perStudent, balance_paise: balance };
}
