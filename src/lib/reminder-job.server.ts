import type { Database } from "@/integrations/supabase/types";
import { authenticateJobRequest } from "./job-auth.server";
import type { Db } from "./studio.server";
import {
  getWhatsAppProvider,
  renderReminder,
  toInternationalPhone,
  type WhatsAppProvider,
} from "./whatsapp.server";

export const MAX_ATTEMPTS = 5;

export type ReminderRow = Database["public"]["Tables"]["reminders"]["Row"];

/** Everything the job needs from the database, so the sending rules can be tested without one. */
export interface ReminderStore {
  claim(limit: number, leaseSeconds: number): Promise<ReminderRow[]>;
  guardianPhones(guardianIds: string[]): Promise<Map<string, string | null>>;
  markSent(id: string, attempts: number, providerMessageId: string, at: Date): Promise<void>;
  requeue(id: string, attempts: number, nextAttemptAt: Date, error: string): Promise<void>;
  markFailed(id: string, attempts: number, error: string): Promise<void>;
}

export type JobResult =
  | { status: "provider_not_configured" }
  | { status: "ok"; claimed: number; sent: number; requeued: number; failed: number };

/** Minutes to wait before the next try: 5, 10, 20, 40 ... capped at six hours. */
export function backoffMinutes(attempt: number): number {
  return Math.min(5 * 2 ** (attempt - 1), 360);
}

export async function runReminderJob(deps: {
  store: ReminderStore;
  provider: WhatsAppProvider | null;
  now?: () => Date;
  batchSize?: number;
  leaseSeconds?: number;
}): Promise<JobResult> {
  // With no provider nothing is claimed, so no reminder loses an attempt and none is marked sent.
  if (!deps.provider) return { status: "provider_not_configured" };
  const { store, provider } = deps;
  const now = deps.now ?? (() => new Date());

  const rows = await store.claim(deps.batchSize ?? 25, deps.leaseSeconds ?? 300);
  const phones = rows.length
    ? await store.guardianPhones([...new Set(rows.map((row) => row.guardian_id))])
    : new Map();
  const result = { claimed: rows.length, sent: 0, requeued: 0, failed: 0 };

  for (const row of rows) {
    if (row.attempts >= MAX_ATTEMPTS) {
      await store.markFailed(row.id, row.attempts, "Gave up after repeated worker failures.");
      result.failed++;
      continue;
    }
    const attempts = row.attempts + 1;
    const message = renderReminder(row.kind, row.payload);
    const to = toInternationalPhone(phones.get(row.guardian_id));
    if (!message || !to) {
      await store.markFailed(
        row.id,
        attempts,
        message
          ? "The guardian has no usable WhatsApp number."
          : "The reminder is missing details.",
      );
      result.failed++;
      continue;
    }

    let outcome: Awaited<ReturnType<WhatsAppProvider["send"]>>;
    try {
      outcome = await provider.send({
        to,
        templateName: message.templateName,
        variables: message.variables,
        text: message.text,
      });
    } catch {
      outcome = { ok: false, retryable: true, error: "The WhatsApp provider failed unexpectedly." };
    }

    if (outcome.ok) {
      await store.markSent(row.id, attempts, outcome.providerMessageId, now());
      result.sent++;
    } else if (outcome.retryable && attempts < MAX_ATTEMPTS) {
      await store.requeue(
        row.id,
        attempts,
        new Date(now().getTime() + backoffMinutes(attempts) * 60_000),
        outcome.error,
      );
      result.requeued++;
    } else {
      await store.markFailed(row.id, attempts, outcome.error);
      result.failed++;
    }
  }
  return { status: "ok", ...result };
}

/** The store backed by Supabase with the service role. Only ever used from the job endpoint. */
export class SupabaseReminderStore implements ReminderStore {
  constructor(private readonly admin: Db) {}

  async claim(limit: number, leaseSeconds: number) {
    const { data, error } = await this.admin.rpc("claim_due_reminders", {
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    });
    if (error) throw new Error("Could not claim reminders.");
    return data;
  }

  async guardianPhones(guardianIds: string[]) {
    const { data, error } = await this.admin
      .from("guardians")
      .select("id, phone")
      .in("id", guardianIds);
    if (error) throw new Error("Could not load guardian phone numbers.");
    return new Map(data.map((guardian) => [guardian.id, guardian.phone]));
  }

  private async finish(id: string, values: Database["public"]["Tables"]["reminders"]["Update"]) {
    // Only a reminder still held by a worker (sending) can be finished, so a late result never overwrites a newer one.
    const { error } = await this.admin
      .from("reminders")
      .update({ ...values, lease_expires_at: null })
      .eq("id", id)
      .eq("status", "sending");
    if (error) throw new Error("Could not record a reminder result.");
  }

  markSent(id: string, attempts: number, providerMessageId: string, at: Date) {
    return this.finish(id, {
      status: "sent",
      attempts,
      provider_message_id: providerMessageId,
      sent_at: at.toISOString(),
      last_error: null,
    });
  }
  requeue(id: string, attempts: number, nextAttemptAt: Date, error: string) {
    return this.finish(id, {
      status: "queued",
      attempts,
      next_attempt_at: nextAttemptAt.toISOString(),
      last_error: error,
    });
  }
  markFailed(id: string, attempts: number, error: string) {
    return this.finish(id, { status: "failed", attempts, last_error: error });
  }
}

/** Handle a call from the scheduler: check the secret, run one batch, report what happened. */
export async function handleReminderJob(request: Request): Promise<Response> {
  const denied = authenticateJobRequest(request);
  if (denied) return denied;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await runReminderJob({
    store: new SupabaseReminderStore(supabaseAdmin),
    provider: getWhatsAppProvider(),
  });
  return Response.json(result, { status: result.status === "ok" ? 200 : 503 });
}
