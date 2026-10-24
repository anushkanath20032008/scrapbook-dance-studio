import { randomInt } from "node:crypto";
import { hashToken, newToken } from "./family.server";
import { friendlyError, unwrap, type StudioContext } from "./studio.server";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A short code to read out or type: 8 characters, no look-alikes (0/O, 1/I). Only its hash is stored. */
const newCode = () =>
  Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

export async function inviteInstructor(
  { supabase }: StudioContext,
  input: { email: string | null; days: 1 | 7 | 30 },
  baseUrl: string,
) {
  const token = newToken();
  const code = newCode();
  const created = unwrap(
    await supabase.rpc("create_instructor_invite", {
      p_email: input.email,
      p_days: input.days,
      p_token_hash: hashToken(token),
      p_code_hash: hashToken(code),
    }),
  );
  // The link and code are shown once; afterwards only their hashes exist.
  return {
    url: `${baseUrl.replace(/\/+$/, "")}/join?code=${token}`,
    code: `${code.slice(0, 4)}-${code.slice(4)}`,
    expiresAt: created[0]?.expires_at ?? null,
  };
}

export async function listInstructors({ supabase }: StudioContext) {
  return unwrap(
    await supabase
      .from("studio_instructors")
      .select("id, email, expires_at, accepted_at, created_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
  );
}

export async function removeInstructor({ supabase }: StudioContext, input: { id: string }) {
  const { data, error } = await supabase
    .from("studio_instructors")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw friendlyError(error);
  if (!data) throw new Error("That person was not found or is already removed.");
  return { removed: true };
}

/** Accept an invite for the signed-in account. studioName is null when the invite does not work. */
export async function acceptInstructorInvite(
  { supabase }: StudioContext,
  input: { secret: string },
) {
  const { data, error } = await supabase.rpc("redeem_instructor_invite", {
    p_secret: input.secret,
  });
  if (error) throw friendlyError(error);
  return { studioName: data };
}

/** The studio the caller teaches at, or null for anyone who is not an instructor. */
export async function getInstructorMe({ supabase }: StudioContext) {
  const { data, error } = await supabase.rpc("instructor_me");
  if (error) throw friendlyError(error);
  return data?.[0] ?? null;
}

export async function getInstructorBatches({ supabase }: StudioContext) {
  return unwrap(await supabase.rpc("instructor_batches"));
}

export async function getInstructorRoster({ supabase }: StudioContext, input: { batchId: string }) {
  return unwrap(await supabase.rpc("instructor_batch_roster", { p_batch: input.batchId }));
}

export async function getInstructorBatchDay(
  { supabase }: StudioContext,
  input: { batchId: string; date: string },
) {
  return unwrap(
    await supabase.rpc("instructor_batch_day", { p_batch: input.batchId, p_on: input.date }),
  );
}

export async function markInstructorAttendance(
  { supabase }: StudioContext,
  input: { batchId: string; date: string; marks: { studentId: string; present: boolean }[] },
) {
  const count = unwrap(
    await supabase.rpc("instructor_mark_attendance", {
      p_batch: input.batchId,
      p_session_on: input.date,
      p_marks: input.marks.map((mark) => ({ student_id: mark.studentId, present: mark.present })),
    }),
  );
  return { marked: count };
}
