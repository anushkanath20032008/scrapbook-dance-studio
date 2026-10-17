import { authenticateJobRequest } from "./job-auth.server";

export type NudgeSummary = {
  studio_id: string;
  unpaid_count: number;
  outstanding_paise: number | string;
  due_today_count: number;
  overdue_count: number;
};

export type Owner = { email: string; studioName: string };

export type Mail = { to: string; subject: string; text: string };

export interface Mailer {
  send(mail: Mail): Promise<{ ok: boolean }>;
}

export type NudgeResult =
  | { status: "mailer_not_configured" }
  | { status: "ok"; studios: number; sent: number; skipped: number; failed: number };

/** Nudge on a due date, and every Monday while anyone is unpaid. Nobody unpaid means no email. */
export function shouldNudge(row: NudgeSummary, today: string): boolean {
  if (row.unpaid_count <= 0) return false;
  const monday = new Date(`${today}T00:00:00Z`).getUTCDay() === 1;
  return row.due_today_count > 0 || monday;
}

function rupees(paise: number | string): string {
  return `₹${(Number(paise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function composeNudge(row: NudgeSummary, owner: Owner, appUrl: string): Mail {
  const people = `${row.unpaid_count} dancer${row.unpaid_count === 1 ? "" : "s"}`;
  const overdue = row.overdue_count > 0 ? ` ${row.overdue_count} already overdue.` : "";
  return {
    to: owner.email,
    subject: `${people} haven't paid this month`,
    text:
      `${people} at ${owner.studioName || "your studio"} still owe ${rupees(row.outstanding_paise)} this month.${overdue}\n\n` +
      `Review who hasn't paid and send reminders in one tap: ${appUrl}/app\n`,
  };
}

export async function runOwnerNudge(deps: {
  summary: () => Promise<NudgeSummary[]>;
  owner: (studioId: string) => Promise<Owner | null>;
  mailer: Mailer | null;
  today: string;
  appUrl: string;
}): Promise<NudgeResult> {
  // With no mailer nothing is attempted, so nothing is lost.
  if (!deps.mailer) return { status: "mailer_not_configured" };
  const rows = await deps.summary();
  const result = { studios: rows.length, sent: 0, skipped: 0, failed: 0 };
  for (const row of rows) {
    if (!shouldNudge(row, deps.today)) {
      result.skipped++;
      continue;
    }
    const owner = await deps.owner(row.studio_id);
    if (!owner) {
      result.skipped++;
      continue;
    }
    try {
      const sent = await deps.mailer.send(composeNudge(row, owner, deps.appUrl));
      if (sent.ok) result.sent++;
      else result.failed++;
    } catch {
      result.failed++;
    }
  }
  return { status: "ok", ...result };
}

/** Sends through Resend (resend.com): a simple HTTPS call with an API key. */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(mail: Mail) {
    try {
      const response = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ from: this.from, to: [mail.to], subject: mail.subject, text: mail.text }),
        signal: AbortSignal.timeout(10_000),
      });
      return { ok: response.ok };
    } catch {
      return { ok: false };
    }
  }
}

export function getMailer(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Mailer | null {
  const key = env["RESEND_API_KEY"]?.trim();
  const from = env["NUDGE_FROM_EMAIL"]?.trim();
  return key && from ? new ResendMailer(key, from, fetchImpl) : null;
}

/** Handle the daily call from the scheduler: check the secret, email the studios that need a nudge. */
export async function handleOwnerNudgeJob(request: Request): Promise<Response> {
  const denied = authenticateJobRequest(request);
  if (denied) return denied;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { todayInIndia } = await import("./validators");
  const today = todayInIndia();
  const result = await runOwnerNudge({
    mailer: getMailer(),
    today,
    appUrl: (process.env["PUBLIC_APP_URL"] ?? "https://choreostudio.live").replace(/\/$/, ""),
    summary: async () => {
      const { data, error } = await supabaseAdmin.rpc("owner_nudge_summary", { p_today: today });
      if (error) throw new Error("Could not load the nudge summary.");
      return data as NudgeSummary[];
    },
    owner: async (studioId) => {
      const [{ data: user }, { data: profile }] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(studioId),
        supabaseAdmin.from("studio_profiles").select("studio_name").eq("user_id", studioId).maybeSingle(),
      ]);
      const email = user?.user?.email;
      return email ? { email, studioName: profile?.studio_name ?? "" } : null;
    },
  });
  return Response.json(result, { status: result.status === "ok" ? 200 : 503 });
}
