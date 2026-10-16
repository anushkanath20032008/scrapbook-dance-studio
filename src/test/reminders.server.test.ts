import { describe, expect, it, vi } from "vitest";
import { listReminders, queueReminders } from "@/lib/reminders.server";
import {
  backoffMinutes,
  MAX_ATTEMPTS,
  runReminderJob,
  type ReminderRow,
  type ReminderStore,
} from "@/lib/reminder-job.server";
import type { SendResult, WhatsAppProvider } from "@/lib/whatsapp.server";
import { fakeSupabase, stepsOf } from "./fake-supabase";

const user = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-10-16T10:00:00Z");

const row = (over: Partial<ReminderRow> = {}): ReminderRow => ({
  id: "r1",
  studio_id: user,
  student_id: "s1",
  guardian_id: "g1",
  charge_id: "c1",
  kind: "fee_due",
  template_name: "fee_due_reminder",
  dedupe_key: "k",
  status: "sending",
  attempts: 0,
  next_attempt_at: now.toISOString(),
  lease_expires_at: null,
  provider_message_id: null,
  sent_at: null,
  last_error: null,
  created_at: now.toISOString(),
  payload: {
    studio_name: "Rhythm House",
    guardian_name: "Meera",
    student_name: "Aarav",
    amount_paise: 90000,
    due_on: "2026-10-05",
    period: "2026-10-01",
  },
  ...over,
});

function memoryStore(rows: ReminderRow[], phone: string | null = "9876543210") {
  const events: string[] = [];
  const store: ReminderStore = {
    claim: vi.fn(async () => rows),
    guardianPhones: vi.fn(async () => new Map([["g1", phone]])),
    markSent: vi.fn(async (id, attempts) => void events.push(`sent:${id}:${attempts}`)),
    requeue: vi.fn(
      async (id, attempts, at) => void events.push(`requeue:${id}:${attempts}:${at.toISOString()}`),
    ),
    markFailed: vi.fn(
      async (id, attempts, error) => void events.push(`failed:${id}:${attempts}:${error}`),
    ),
  };
  return { store, events };
}
const providerReturning = (result: SendResult | Error): WhatsAppProvider => ({
  send: vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  }),
});

describe("queue and list server functions", () => {
  it("queues for the first of the month with the Indian date", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: 4 }));
    expect(
      await queueReminders({ supabase: client, userId: user }, { period: "2026-10-17" }),
    ).toEqual({ queued: 4 });
    expect(calls[0].fn).toBe("queue_fee_reminders");
    expect(calls[0].args).toEqual([
      { p_period: "2026-10-01", p_today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    ]);
  });

  it("lists newest first, filtered by status only when asked", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: [] }));
    await listReminders({ supabase: client, userId: user }, { limit: 50 });
    await listReminders({ supabase: client, userId: user }, { limit: 50, status: "failed" });
    expect(calls[0].table).toBe("reminders");
    expect(stepsOf(calls[0], "eq")).toHaveLength(0);
    expect(stepsOf(calls[1] ?? calls[0], "eq")[0]).toEqual(["status", "failed"]);
  });
});

describe("runReminderJob", () => {
  it("claims nothing and sends nothing without a provider", async () => {
    const { store } = memoryStore([row()]);
    expect(await runReminderJob({ store, provider: null, now: () => now })).toEqual({
      status: "provider_not_configured",
    });
    expect(store.claim).not.toHaveBeenCalled();
  });

  it("marks a sent reminder with the attempt it took", async () => {
    const { store, events } = memoryStore([row()]);
    const provider = providerReturning({ ok: true, providerMessageId: "m1" });
    const result = await runReminderJob({ store, provider, now: () => now });
    expect(result).toMatchObject({ status: "ok", claimed: 1, sent: 1 });
    expect(events).toEqual(["sent:r1:1"]);
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+919876543210", templateName: "fee_due_reminder" }),
    );
  });

  it("requeues a retryable failure with growing backoff", async () => {
    const { store, events } = memoryStore([row({ attempts: 2 })]);
    const result = await runReminderJob({
      store,
      provider: providerReturning({ ok: false, retryable: true, error: "busy" }),
      now: () => now,
    });
    expect(result).toMatchObject({ requeued: 1 });
    expect(events).toEqual([`requeue:r1:3:${new Date(now.getTime() + 20 * 60_000).toISOString()}`]);
  });

  it("fails permanently on a final error or when the last attempt fails", async () => {
    const final = memoryStore([row()]);
    await runReminderJob({
      store: final.store,
      provider: providerReturning({ ok: false, retryable: false, error: "bad number" }),
      now: () => now,
    });
    expect(final.events).toEqual(["failed:r1:1:bad number"]);

    const last = memoryStore([row({ attempts: MAX_ATTEMPTS - 1 })]);
    await runReminderJob({
      store: last.store,
      provider: providerReturning(new Error("boom")),
      now: () => now,
    });
    expect(last.events[0]).toMatch(`failed:r1:${MAX_ATTEMPTS}:`);
  });

  it("gives up on a reminder that already used every attempt without calling the provider", async () => {
    const { store, events } = memoryStore([row({ attempts: MAX_ATTEMPTS })]);
    const provider = providerReturning({ ok: true, providerMessageId: "m" });
    await runReminderJob({ store, provider, now: () => now });
    expect(provider.send).not.toHaveBeenCalled();
    expect(events[0]).toMatch(`failed:r1:${MAX_ATTEMPTS}:`);
  });

  it("fails without calling the provider when the number or the payload is unusable", async () => {
    const provider = providerReturning({ ok: true, providerMessageId: "m" });
    const noPhone = memoryStore([row()], "123");
    await runReminderJob({ store: noPhone.store, provider, now: () => now });
    const badPayload = memoryStore([row({ payload: {} })]);
    await runReminderJob({ store: badPayload.store, provider, now: () => now });
    expect(provider.send).not.toHaveBeenCalled();
    expect(noPhone.events[0]).toContain("usable WhatsApp number");
    expect(badPayload.events[0]).toContain("missing details");
  });

  it("backs off 5, 10, 20 minutes and caps at six hours", () => {
    expect([1, 2, 3].map(backoffMinutes)).toEqual([5, 10, 20]);
    expect(backoffMinutes(20)).toBe(360);
  });
});
