import { describe, expect, it, vi } from "vitest";
import { hashToken } from "@/lib/family.server";
import { reminderText } from "@/lib/manual-reminders";
import {
  authenticateTelegramRequest,
  createTelegramClient,
  createTelegramInvite,
  handleTelegramUpdate,
  listTelegramRecipients,
  sendTelegramReminders,
  telegramConfig,
  type SendOutcome,
  type TelegramClient,
} from "@/lib/telegram.server";
import type { StudioContext } from "@/lib/studio.server";
import { fakeSupabase, stepsOf, type Call } from "./fake-supabase";

const owner = "11111111-1111-4111-8111-111111111111";
const guardian = "33333333-3333-4333-8333-333333333333";
const student = "44444444-4444-4444-8444-444444444444";
const charge = "55555555-5555-4555-8555-555555555555";
const token = "B".repeat(43);
const chat = 777001;

function botStub(outcomes: SendOutcome[] = []) {
  const sendMessage = vi.fn(async (..._args: Parameters<TelegramClient["sendMessage"]>) =>
    outcomes.shift() ?? ({ ok: true } as SendOutcome),
  );
  const answerCallback = vi.fn(async (..._args: Parameters<TelegramClient["answerCallback"]>) => {});
  return { client: { sendMessage, answerCallback } satisfies TelegramClient, sendMessage, answerCallback };
}

const start = (text: string) => ({ message: { text, chat: { id: chat, type: "private" } } });
const tap = (data: string) => ({
  callback_query: { id: "cb1", data, message: { chat: { id: chat } } },
});

describe("webhook secret and config", () => {
  const request = (secret?: string) =>
    new Request("https://x.test/api/webhooks/telegram", {
      method: "POST",
      headers: secret === undefined ? {} : { "x-telegram-bot-api-secret-token": secret },
    });

  it("accepts only the configured secret header", () => {
    const env = { TELEGRAM_WEBHOOK_SECRET: "s3cret_value" };
    expect(authenticateTelegramRequest(request("s3cret_value"), env)).toBeNull();
    expect(authenticateTelegramRequest(request("wrong"), env)?.status).toBe(401);
    expect(authenticateTelegramRequest(request(), env)?.status).toBe(401);
  });

  it("refuses everything when no secret is configured", () => {
    expect(authenticateTelegramRequest(request("anything"), {})?.status).toBe(500);
  });

  it("needs all three settings and strips a leading @ from the username", () => {
    expect(telegramConfig({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_BOT_USERNAME: "b" })).toBeNull();
    expect(
      telegramConfig({
        TELEGRAM_BOT_TOKEN: "t",
        TELEGRAM_BOT_USERNAME: "@choreo_bot",
        TELEGRAM_WEBHOOK_SECRET: "s",
      }),
    ).toEqual({ token: "t", username: "choreo_bot", secret: "s" });
  });
});

describe("Telegram client", () => {
  const respond = (status: number, body: unknown) =>
    createTelegramClient("TOKEN", (async () =>
      new Response(JSON.stringify(body), { status })) as typeof fetch);

  it("maps Telegram answers to outcomes", async () => {
    expect(await respond(200, { ok: true }).sendMessage(1, "hi")).toEqual({ ok: true });
    expect(await respond(403, { ok: false }).sendMessage(1, "hi")).toEqual({
      ok: false,
      kind: "blocked",
    });
    expect(
      await respond(429, { ok: false, parameters: { retry_after: 7 } }).sendMessage(1, "hi"),
    ).toEqual({ ok: false, kind: "rate_limited", retryAfter: 7 });
    expect(await respond(500, {}).sendMessage(1, "hi")).toEqual({ ok: false, kind: "failed" });
  });

  it("posts to the bot's own method URL with the keyboard", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    await createTelegramClient("TOKEN", fetchMock as unknown as typeof fetch).sendMessage(5, "yo", [
      [{ text: "I've paid", callback_data: "paid:x" }],
    ]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/botTOKEN/sendMessage");
    expect(JSON.parse(init.body as string)).toMatchObject({
      chat_id: 5,
      reply_markup: { inline_keyboard: [[{ callback_data: "paid:x" }]] },
    });
  });
});

describe("invite", () => {
  it("stores only the hash and returns a t.me start link", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: { id: "link1" } }));
    const { url } = await createTelegramInvite(
      { supabase: client, userId: owner },
      { guardianId: guardian },
      "choreo_bot",
    );
    const match = /^https:\/\/t\.me\/choreo_bot\?start=([A-Za-z0-9_-]{43})$/.exec(url);
    expect(match).not.toBeNull();
    const inserted = stepsOf(calls[0] as Call, "insert")[0]?.[0] as Record<string, string>;
    expect(inserted["token_hash"]).toBe(hashToken(match![1] as string));
    expect(JSON.stringify(inserted)).not.toContain(match![1] as string);
    expect(inserted["studio_id"]).toBe(owner);
  });
});

describe("a dancer joins with /start <token>", () => {
  const admin = (outcome: string | null, rpcError = false) =>
    fakeSupabase((call) => {
      if (call.fn === "redeem_telegram_link")
        return rpcError
          ? { error: { code: "XX000", message: "boom" } }
          : { data: outcome ? [{ outcome, studio_id: owner, guardian_id: guardian }] : [] };
      if (call.table === "studio_profiles") return { data: { studio_name: "Nritya Hub" } };
      return undefined;
    });

  it("redeems the hashed token for this chat and welcomes them by studio name", async () => {
    const { client, calls } = admin("joined");
    const bot = botStub();
    await handleTelegramUpdate(client, bot.client, start(`/start ${token}`));
    const rpc = calls.find((c) => c.fn === "redeem_telegram_link");
    expect(rpc?.args?.[0]).toEqual({ p_token_hash: hashToken(token), p_chat_id: chat });
    expect(bot.sendMessage.mock.calls[0]?.[0]).toBe(chat);
    expect(bot.sendMessage.mock.calls[0]?.[1]).toContain("Nritya Hub");
    expect(bot.sendMessage.mock.calls[0]?.[1]).toContain("set up");
  });

  it("says so when the same chat taps the link again", async () => {
    const bot = botStub();
    await handleTelegramUpdate(admin("already").client, bot.client, start(`/start ${token}`));
    expect(bot.sendMessage.mock.calls[0]?.[1]).toContain("already set up");
  });

  it("gives one message for an unknown, revoked or used link", async () => {
    const bot = botStub();
    await handleTelegramUpdate(admin("invalid").client, bot.client, start(`/start ${token}`));
    expect(bot.sendMessage.mock.calls[0]?.[1]).toContain("not valid or was already used");
  });

  it("does not even look up a malformed token", async () => {
    const { client, calls } = admin("joined");
    const bot = botStub();
    await handleTelegramUpdate(client, bot.client, start("/start short"));
    expect(calls).toHaveLength(0);
    expect(bot.sendMessage.mock.calls[0]?.[1]).toContain("not valid");
  });

  it("explains itself when started without a link, and ignores other chatter and groups", async () => {
    const bot = botStub();
    const { client, calls } = admin("joined");
    await handleTelegramUpdate(client, bot.client, start("/start"));
    expect(bot.sendMessage.mock.calls[0]?.[1]).toContain("personal link");
    await handleTelegramUpdate(client, bot.client, start("hello there"));
    await handleTelegramUpdate(client, bot.client, {
      message: { text: `/start ${token}`, chat: { id: chat, type: "group" } },
    });
    await handleTelegramUpdate(client, bot.client, { weird: true });
    await handleTelegramUpdate(client, bot.client, null);
    expect(bot.sendMessage).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
  });

  it("tells the dancer to retry when the database fails", async () => {
    const bot = botStub();
    await handleTelegramUpdate(admin(null, true).client, bot.client, start(`/start ${token}`));
    expect(bot.sendMessage.mock.calls[0]?.[1]).toContain("Something went wrong");
  });
});

describe("the I've paid button", () => {
  type Options = {
    linked?: boolean;
    owed?: number;
    pending?: boolean;
    claimError?: boolean;
    voided?: boolean;
  };
  const admin = (o: Options = {}) =>
    fakeSupabase((call) => {
      if (call.table === "charges")
        return {
          data: {
            id: charge,
            studio_id: owner,
            student_id: student,
            period: "2026-10-01",
            voided_at: o.voided ? "2026-10-02" : null,
          },
        };
      if (call.table === "students") return { data: { guardian_id: guardian } };
      if (call.table === "telegram_links") return { data: o.linked === false ? null : { id: "l1" } };
      if (call.fn === "student_ledger_status")
        return { data: [{ charge_id: charge, outstanding_paise: o.owed ?? 150000 }] };
      if (call.table === "payment_claims") return { data: o.pending ? [{ id: "c0" }] : [] };
      if (call.fn === "submit_payment_claim")
        return o.claimError
          ? { error: { code: "P0001", message: "five payments are already waiting" } }
          : { data: { id: "claim1" } };
      return undefined;
    });

  it("creates one pending claim for what is still owed, as method other", async () => {
    const { client, calls } = admin();
    const bot = botStub();
    await handleTelegramUpdate(client, bot.client, tap(`paid:${charge}`));
    const claim = calls.find((c) => c.fn === "submit_payment_claim");
    expect(claim?.args?.[0]).toMatchObject({
      p_guardian: guardian,
      p_student: student,
      p_amount_paise: 150000,
      p_method: "other",
    });
    expect(bot.answerCallback).toHaveBeenCalledWith("cb1");
    expect(bot.sendMessage.mock.calls[0]?.[1]).toContain("will check the payment");
  });

  it("refuses a chat that is not joined to that dancer", async () => {
    const { client, calls } = admin({ linked: false });
    const bot = botStub();
    await handleTelegramUpdate(client, bot.client, tap(`paid:${charge}`));
    expect(calls.some((c) => c.fn === "submit_payment_claim")).toBe(false);
    expect(bot.sendMessage.mock.calls[0]?.[1]).toContain("could not find");
  });

  it("does not stack claims or claim a settled or voided fee", async () => {
    for (const [options, text] of [
      [{ pending: true }, "already has your payment note"],
      [{ owed: 0 }, "Nothing is owed"],
      [{ voided: true }, "could not find"],
    ] as const) {
      const { client, calls } = admin(options);
      const bot = botStub();
      await handleTelegramUpdate(client, bot.client, tap(`paid:${charge}`));
      expect(calls.some((c) => c.fn === "submit_payment_claim")).toBe(false);
      expect(bot.sendMessage.mock.calls[0]?.[1]).toContain(text);
    }
  });

  it("ignores a malformed button and never touches the database", async () => {
    const { client, calls } = admin();
    const bot = botStub();
    await handleTelegramUpdate(client, bot.client, tap("paid:not-a-uuid"));
    await handleTelegramUpdate(client, bot.client, tap("other"));
    expect(calls).toHaveLength(0);
    expect(bot.sendMessage).not.toHaveBeenCalled();
    expect(bot.answerCallback).toHaveBeenCalledTimes(2);
  });

  it("apologises when the claim cannot be saved", async () => {
    const bot = botStub();
    await handleTelegramUpdate(admin({ claimError: true }).client, bot.client, tap(`paid:${charge}`));
    expect(bot.sendMessage.mock.calls[0]?.[1]).toContain("could not send that");
  });
});

describe("owner sends reminders", () => {
  const today = "2026-10-21";
  const second = "66666666-6666-4666-8666-666666666666";
  const guardian2 = "77777777-7777-4777-8777-777777777777";
  const student2 = "88888888-8888-4888-8888-888888888888";
  const unpaid = [
    {
      charge_id: charge,
      student_id: student,
      student_name: "Bindu",
      outstanding_paise: 150000,
      due_on: "2026-10-05",
    },
    {
      charge_id: second,
      student_id: student2,
      student_name: "Pushpak",
      outstanding_paise: 90000,
      due_on: "2026-10-05",
    },
  ];

  function world(
    over: { joined?: Record<string, number>; reminded?: string[]; claimed?: boolean[] } = {},
  ) {
    const joined = over.joined ?? { [guardian]: chat, [guardian2]: 777002 };
    const claimed = [...(over.claimed ?? [])];
    const owned = fakeSupabase((call) => {
      if (call.fn === "unpaid_students") return { data: unpaid };
      if (call.table === "students")
        return {
          data: [
            { id: student, guardian_id: guardian },
            { id: student2, guardian_id: guardian2 },
          ],
        };
      if (call.table === "telegram_links")
        return { data: Object.entries(joined).map(([g, c]) => ({ guardian_id: g, chat_id: c })) };
      if (call.table === "telegram_reminder_log")
        return { data: (over.reminded ?? []).map((id) => ({ charge_id: id })) };
      if (call.table === "studio_profiles") return { data: { studio_name: "Nritya Hub" } };
      return undefined;
    });
    const adminDb = fakeSupabase((call) => {
      if (call.table === "telegram_reminder_log" && stepsOf(call, "upsert").length)
        return { data: claimed.shift() === false ? [] : [{ id: "log" }] };
      return undefined;
    });
    return { owned, adminDb, context: { supabase: owned.client, userId: owner } as StudioContext };
  }
  const sleep = async () => {};

  it("lists who joined and who was reminded today, without exposing chat ids", async () => {
    const { context } = world({ joined: { [guardian]: chat }, reminded: [charge] });
    const rows = await listTelegramRecipients(context, { period: "2026-10-01" }, today);
    expect(rows).toEqual([
      expect.objectContaining({ charge_id: charge, joined: true, reminded: true }),
      expect.objectContaining({ charge_id: second, joined: false, reminded: false }),
    ]);
    expect(JSON.stringify(rows)).not.toContain(String(chat));
  });

  it("sends each chosen joined dancer their own amount with the same wording as WhatsApp", async () => {
    const { context, adminDb } = world();
    const bot = botStub();
    const summary = await sendTelegramReminders(
      context,
      adminDb.client,
      bot.client,
      { period: "2026-10-01", chargeIds: [charge, second] },
      { today, sleep },
    );
    expect(summary).toMatchObject({ sent: 2, failed: 0, blocked: 0 });
    expect(bot.sendMessage.mock.calls[0]?.[0]).toBe(chat);
    expect(bot.sendMessage.mock.calls[0]?.[1]).toBe(
      reminderText(unpaid[0]!, "Nritya Hub"),
    );
    expect(bot.sendMessage.mock.calls[0]?.[1]).toContain("₹1,500");
    expect(bot.sendMessage.mock.calls[1]?.[1]).toContain("Pushpak");
    expect(bot.sendMessage.mock.calls[1]?.[1]).toContain("₹900");
    expect(bot.sendMessage.mock.calls[0]?.[2]).toEqual([
      [{ text: "I've paid", callback_data: `paid:${charge}` }],
    ]);
  });

  it("sends only what the owner picked, and skips the not joined and the already reminded", async () => {
    const { context, adminDb } = world({ joined: { [guardian]: chat }, reminded: [charge] });
    const bot = botStub();
    const summary = await sendTelegramReminders(
      context,
      adminDb.client,
      bot.client,
      { period: "2026-10-01", chargeIds: [charge, second] },
      { today, sleep },
    );
    expect(summary).toMatchObject({ sent: 0, alreadyReminded: 1, notJoined: 1 });
    expect(bot.sendMessage).not.toHaveBeenCalled();

    const picked = world();
    const bot2 = botStub();
    const only = await sendTelegramReminders(
      picked.context,
      picked.adminDb.client,
      bot2.client,
      { period: "2026-10-01", chargeIds: [second] },
      { today, sleep },
    );
    expect(only.sent).toBe(1);
    expect(bot2.sendMessage.mock.calls[0]?.[0]).toBe(777002);
  });

  it("does not double send when another click already claimed the day's log row", async () => {
    const { context, adminDb } = world({ claimed: [false] });
    const bot = botStub();
    const summary = await sendTelegramReminders(
      context,
      adminDb.client,
      bot.client,
      { period: "2026-10-01", chargeIds: [charge] },
      { today, sleep },
    );
    expect(summary).toMatchObject({ sent: 0, alreadyReminded: 1 });
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });

  it("revokes a dancer who blocked the bot and releases the day's log row", async () => {
    const { context, adminDb } = world();
    const bot = botStub([{ ok: false, kind: "blocked" }]);
    const summary = await sendTelegramReminders(
      context,
      adminDb.client,
      bot.client,
      { period: "2026-10-01", chargeIds: [charge, second] },
      { today, sleep },
    );
    expect(summary).toMatchObject({ sent: 1, blocked: 1 });
    const calls = adminDb.calls;
    expect(
      calls.some(
        (c) => c.table === "telegram_links" && stepsOf(c, "update").length > 0,
      ),
    ).toBe(true);
    expect(
      calls.some((c) => c.table === "telegram_reminder_log" && stepsOf(c, "delete").length > 0),
    ).toBe(true);
  });

  it("stops the batch when Telegram asks to slow down", async () => {
    const { context, adminDb } = world();
    const bot = botStub([{ ok: false, kind: "rate_limited", retryAfter: 5 }]);
    const summary = await sendTelegramReminders(
      context,
      adminDb.client,
      bot.client,
      { period: "2026-10-01", chargeIds: [charge, second] },
      { today, sleep },
    );
    expect(summary).toMatchObject({ sent: 0, failed: 1, stopped: true });
    expect(bot.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("paces sends under Telegram's 30 a second", async () => {
    const { context, adminDb } = world();
    const pauses: number[] = [];
    await sendTelegramReminders(
      context,
      adminDb.client,
      botStub().client,
      { period: "2026-10-01", chargeIds: [charge, second] },
      { today, sleep: async (ms) => void pauses.push(ms) },
    );
    expect(pauses).toHaveLength(2);
    expect(pauses.every((ms) => ms >= 34)).toBe(true);
  });
});
