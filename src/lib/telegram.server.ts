import { createHash, timingSafeEqual } from "node:crypto";
import { hashToken, newToken } from "./family.server";
import { reminderText } from "./manual-reminders";
import { friendlyError, unwrap, type Db, type StudioContext } from "./studio.server";
import { todayInIndia } from "./validators";

// A free reminder channel. Telegram bots can only message people who opened the bot first, so a dancer joins by
// tapping a private invite link (t.me/<bot>?start=<token>). The owner reviews the recipients and presses Send;
// nothing here sends on its own. The Telegram calls below follow the Bot API from memory and were not run against
// a live bot (see the handoff).

export type TelegramConfig = { token: string; username: string; secret: string };

/** All three settings are server-only. Anything missing means the channel is off. */
export function telegramConfig(
  env: Record<string, string | undefined> = process.env,
): TelegramConfig | null {
  const token = env["TELEGRAM_BOT_TOKEN"]?.trim();
  const username = env["TELEGRAM_BOT_USERNAME"]?.trim().replace(/^@/, "");
  const secret = env["TELEGRAM_WEBHOOK_SECRET"]?.trim();
  return token && username && secret ? { token, username, secret } : null;
}

export function getTelegramStatus() {
  const config = telegramConfig();
  return { configured: config !== null, botUsername: config?.username ?? null };
}

/** Telegram echoes the secret given to setWebhook in this header on every update. */
export function authenticateTelegramRequest(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): Response | null {
  const secret = env["TELEGRAM_WEBHOOK_SECRET"]?.trim();
  if (!secret) return new Response("Server configuration error", { status: 500 });
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  if (!timingSafeEqual(digest(given), digest(secret)))
    return new Response("Unauthorized", { status: 401 });
  return null;
}

export type SendOutcome =
  | { ok: true }
  | { ok: false; kind: "blocked" | "rate_limited" | "failed"; retryAfter?: number };

export type InlineButton = { text: string; callback_data: string };

export interface TelegramClient {
  sendMessage(chatId: number, text: string, buttons?: InlineButton[][]): Promise<SendOutcome>;
  answerCallback(callbackId: string, text?: string): Promise<void>;
}

export function createTelegramClient(
  token: string,
  fetchImpl: typeof fetch = fetch,
): TelegramClient {
  const call = async (method: string, body: unknown) => {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as {
      ok?: boolean;
      parameters?: { retry_after?: number };
    } | null;
    return { status: response.status, json };
  };
  return {
    async sendMessage(chatId, text, buttons) {
      try {
        const { status, json } = await call("sendMessage", {
          chat_id: chatId,
          text,
          ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
        });
        if (status === 200 && json?.ok) return { ok: true };
        if (status === 403) return { ok: false, kind: "blocked" };
        if (status === 429)
          return {
            ok: false,
            kind: "rate_limited",
            ...(json?.parameters?.retry_after ? { retryAfter: json.parameters.retry_after } : {}),
          };
        return { ok: false, kind: "failed" };
      } catch {
        return { ok: false, kind: "failed" };
      }
    },
    async answerCallback(callbackId, text) {
      try {
        await call("answerCallbackQuery", {
          callback_query_id: callbackId,
          ...(text ? { text } : {}),
        });
      } catch {
        // The tap still worked; only the little confirmation toast is lost.
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------- owner side

const inviteShape = /^[A-Za-z0-9_-]{43}$/;

export async function createTelegramInvite(
  { supabase, userId }: StudioContext,
  input: { guardianId: string },
  username: string,
) {
  const token = newToken();
  unwrap(
    await supabase
      .from("telegram_links")
      .insert({ studio_id: userId, guardian_id: input.guardianId, token_hash: hashToken(token) })
      .select("id")
      .single(),
  );
  // Shown once; afterwards only the hash exists.
  return { url: `https://t.me/${username}?start=${token}` };
}

export async function listTelegramLinks(
  { supabase }: StudioContext,
  input: { guardianId?: string | undefined },
) {
  let query = supabase
    .from("telegram_links")
    .select("id, guardian_id, joined_at, revoked_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (input.guardianId) query = query.eq("guardian_id", input.guardianId);
  return unwrap(await query);
}

export async function revokeTelegramLink({ supabase }: StudioContext, input: { id: string }) {
  const { data, error } = await supabase
    .from("telegram_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw friendlyError(error);
  if (!data) throw new Error("That link was not found or is already revoked.");
  return { revoked: true };
}

type Target = {
  charge_id: string;
  student_id: string;
  student_name: string;
  outstanding_paise: number;
  due_on: string;
  chatId: number | null;
  reminded: boolean;
};

async function loadTargets({ supabase }: StudioContext, period: string, today: string) {
  const unpaid = unwrap(await supabase.rpc("unpaid_students", { p_period: period }));
  if (unpaid.length === 0) return [] as Target[];
  const studentIds = [...new Set(unpaid.map((row) => row.student_id))];
  const [students, links, log] = await Promise.all([
    supabase.from("students").select("id, guardian_id").in("id", studentIds),
    supabase
      .from("telegram_links")
      .select("guardian_id, chat_id")
      .not("chat_id", "is", null)
      .is("revoked_at", null),
    supabase.from("telegram_reminder_log").select("charge_id").eq("sent_on", today),
  ]);
  const guardianOf = new Map(unwrap(students).map((row) => [row.id, row.guardian_id]));
  const chatOf = new Map(unwrap(links).map((row) => [row.guardian_id, row.chat_id]));
  const reminded = new Set(unwrap(log).map((row) => row.charge_id));
  return unpaid.map((row) => {
    const guardian = guardianOf.get(row.student_id);
    return {
      charge_id: row.charge_id,
      student_id: row.student_id,
      student_name: row.student_name,
      outstanding_paise: Number(row.outstanding_paise),
      due_on: row.due_on,
      chatId: (guardian ? chatOf.get(guardian) : null) ?? null,
      reminded: reminded.has(row.charge_id),
    };
  });
}

/** Who owes for the month, whether they have joined the bot, and whether they were already reminded today. */
export async function listTelegramRecipients(
  context: StudioContext,
  input: { period: string },
  today = todayInIndia(),
) {
  const targets = await loadTargets(context, input.period, today);
  return targets.map(({ chatId, ...rest }) => ({ ...rest, joined: chatId !== null }));
}

export type SendSummary = {
  sent: number;
  blocked: number;
  failed: number;
  alreadyReminded: number;
  notJoined: number;
  /** Telegram asked us to slow down, so the rest were left unsent. */
  stopped: boolean;
};

const PAUSE_MS = 40; // about 25 messages a second, under Telegram's 30 a second

/**
 * Send the reminder to the chosen unpaid dancers who joined the bot. Each charge gets at most one Telegram
 * reminder per India day (claimed in the log before sending, released if Telegram refuses). The "I've paid"
 * button only creates a pending claim the owner still has to confirm.
 */
export async function sendTelegramReminders(
  context: StudioContext,
  admin: Db,
  client: TelegramClient,
  input: { period: string; chargeIds: string[] },
  options: { today?: string; sleep?: (ms: number) => Promise<void> } = {},
): Promise<SendSummary> {
  const today = options.today ?? todayInIndia();
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const chosen = new Set(input.chargeIds);
  const targets = (await loadTargets(context, input.period, today)).filter((t) =>
    chosen.has(t.charge_id),
  );
  const profile = await context.supabase
    .from("studio_profiles")
    .select("studio_name")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (profile.error) throw friendlyError(profile.error);
  const studioName = profile.data?.studio_name ?? "";
  const summary: SendSummary = {
    sent: 0,
    blocked: 0,
    failed: 0,
    alreadyReminded: 0,
    notJoined: 0,
    stopped: false,
  };

  for (const target of targets) {
    if (target.chatId === null) {
      summary.notJoined++;
      continue;
    }
    if (target.reminded) {
      summary.alreadyReminded++;
      continue;
    }
    if (summary.stopped) continue;

    const claimed = await admin
      .from("telegram_reminder_log")
      .upsert(
        { studio_id: context.userId, charge_id: target.charge_id, sent_on: today },
        { onConflict: "charge_id,sent_on", ignoreDuplicates: true },
      )
      .select("id");
    if (claimed.error) {
      summary.failed++;
      continue;
    }
    if ((claimed.data ?? []).length === 0) {
      summary.alreadyReminded++;
      continue;
    }

    const outcome = await client.sendMessage(
      target.chatId,
      reminderText(target, studioName),
      [[{ text: "I've paid", callback_data: `paid:${target.charge_id}` }]],
    );
    if (outcome.ok) {
      summary.sent++;
    } else {
      await admin
        .from("telegram_reminder_log")
        .delete()
        .eq("charge_id", target.charge_id)
        .eq("sent_on", today);
      if (outcome.kind === "blocked") {
        // The dancer blocked or left the bot: stop treating them as joined.
        await admin
          .from("telegram_links")
          .update({ revoked_at: new Date().toISOString() })
          .eq("studio_id", context.userId)
          .eq("chat_id", target.chatId)
          .is("revoked_at", null);
        summary.blocked++;
      } else if (outcome.kind === "rate_limited") {
        summary.stopped = true;
        summary.failed++;
      } else {
        summary.failed++;
      }
    }
    await sleep(PAUSE_MS);
  }
  return summary;
}

// ------------------------------------------------------------------------------------------------ bot side

type TelegramUpdate = {
  message?: { text?: string; chat?: { id?: number; type?: string } };
  callback_query?: {
    id?: string;
    data?: string;
    message?: { chat?: { id?: number } };
  };
};

const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAIM_REFERENCE = "Telegram: I've paid";

/** Handle one update from the webhook. Never throws for a bad or unknown update: the bot just says it can't help. */
export async function handleTelegramUpdate(admin: Db, client: TelegramClient, update: unknown) {
  const u = (update ?? {}) as TelegramUpdate;
  try {
    const tap = u.callback_query;
    if (tap?.id) {
      const chatId = tap.message?.chat?.id;
      const match = /^paid:([0-9a-f-]{36})$/i.exec(tap.data ?? "");
      if (typeof chatId !== "number" || !match || !uuidShape.test(match[1] ?? "")) {
        await client.answerCallback(tap.id);
        return;
      }
      const reply = await handlePaidTap(admin, chatId, match[1] as string);
      await client.answerCallback(tap.id);
      await client.sendMessage(chatId, reply);
      return;
    }

    const message = u.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim();
    if (typeof chatId !== "number" || message?.chat?.type !== "private" || !text) return;
    if (!/^\/start(@\w+)?(\s|$)/.test(text)) return;

    const payload = text.split(/\s+/)[1];
    if (!payload) {
      await client.sendMessage(
        chatId,
        "Hi! Your studio sends you a personal link to join fee reminders here. Ask them for yours.",
      );
      return;
    }
    await client.sendMessage(chatId, await handleJoin(admin, chatId, payload));
  } catch (error) {
    console.error("telegram update failed", error instanceof Error ? error.message : error);
  }
}

async function handleJoin(admin: Db, chatId: number, token: string) {
  const invalid = "This link is not valid or was already used. Ask your studio for a new one.";
  if (!inviteShape.test(token)) return invalid;
  const { data, error } = await admin.rpc("redeem_telegram_link", {
    p_token_hash: hashToken(token),
    p_chat_id: chatId,
  });
  if (error) return "Something went wrong. Please tap the link again in a minute.";
  const row = data?.[0];
  if (!row || row.outcome === "invalid") return invalid;
  const studio = await admin
    .from("studio_profiles")
    .select("studio_name")
    .eq("user_id", row.studio_id)
    .maybeSingle();
  const name = studio.data?.studio_name?.trim() || "Your studio";
  return row.outcome === "already"
    ? `You are already set up. ${name} will send fee reminders here.`
    : `You are set up ✓ ${name} will send fee reminders here. When you have paid, tap "I've paid" under a reminder and the studio will check it.`;
}

/** "I've paid": a pending claim for what the ledger still shows owed. The owner confirms it in To verify. */
async function handlePaidTap(admin: Db, chatId: number, chargeId: string) {
  const sorry = "Sorry, I could not find that fee. Please ask your studio.";
  const charge = await admin
    .from("charges")
    .select("id, studio_id, student_id, period, voided_at")
    .eq("id", chargeId)
    .maybeSingle();
  if (charge.error || !charge.data || charge.data.voided_at) return sorry;
  const { studio_id: studioId, student_id: studentId, period } = charge.data;

  const student = await admin
    .from("students")
    .select("guardian_id")
    .eq("id", studentId)
    .eq("studio_id", studioId)
    .is("archived_at", null)
    .maybeSingle();
  const guardianId = student.data?.guardian_id;
  if (student.error || !guardianId) return sorry;

  // The chat must be joined to this dancer, otherwise anyone holding a button could claim for them.
  const link = await admin
    .from("telegram_links")
    .select("id")
    .eq("studio_id", studioId)
    .eq("guardian_id", guardianId)
    .eq("chat_id", chatId)
    .is("revoked_at", null)
    .maybeSingle();
  if (link.error || !link.data) return sorry;

  const statuses = await admin.rpc("student_ledger_status", {
    p_period: period,
    p_student_ids: [studentId],
  });
  if (statuses.error) return "Something went wrong. Please try again in a minute.";
  const owed = Number(statuses.data?.find((s) => s.charge_id === chargeId)?.outstanding_paise ?? 0);
  if (owed <= 0) return "Nothing is owed on that fee any more. Thank you!";

  const waiting = await admin
    .from("payment_claims")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "pending")
    .eq("reference", CLAIM_REFERENCE)
    .limit(1);
  if (waiting.error) return "Something went wrong. Please try again in a minute.";
  if ((waiting.data ?? []).length > 0)
    return "Your studio already has your payment note and will check it soon.";

  const claim = await admin.rpc("submit_payment_claim", {
    p_guardian: guardianId,
    p_student: studentId,
    p_amount_paise: owed,
    p_method: "other",
    p_paid_on: todayInIndia(),
    p_reference: CLAIM_REFERENCE,
  });
  if (claim.error) return "Sorry, I could not send that to your studio. Please tell them directly.";
  return "Thanks! Your studio will check the payment and confirm it.";
}

/** The webhook entry point: check the secret header, parse the update, and hand it to the bot. */
export async function handleTelegramWebhookRequest(request: Request): Promise<Response> {
  const denied = authenticateTelegramRequest(request);
  if (denied) return denied;
  const config = telegramConfig();
  if (!config) return new Response("Server configuration error", { status: 500 });
  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await handleTelegramUpdate(supabaseAdmin, createTelegramClient(config.token), update);
  // Always 200 once authenticated: a non-2xx makes Telegram retry the same update.
  return new Response("ok");
}
