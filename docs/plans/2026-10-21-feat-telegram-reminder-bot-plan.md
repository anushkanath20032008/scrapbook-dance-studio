---
title: "feat: free Telegram bot for payment reminders"
status: active
---

# Telegram reminder bot

Free, owner-initiated reminders through one shared bot. Telegram only lets a bot message people who opened it first, so each dancer joins through a private invite link `t.me/<bot>?start=<token>`. Nothing sends on its own; the owner reviews recipients and presses Send. Student money never moves through the app.

## Decisions (settled by the requester)
- Dancers are adults and never log in; the bot is messaging only.
- Message wording is the WhatsApp tap-to-send wording (shared builder in `manual-reminders.ts`).
- "I've paid" button creates a pending claim (`submit_payment_claim`, method `other`, reference "Telegram"); the owner confirms in To verify, so the payment gate is unchanged.
- Secrets live only in server env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`.
- Migration 0017 is written but not applied.

## Units
1. **U1 Migration 0017**: `telegram_links` (hashed single-use invite, chat id once joined, revocable), `telegram_reminder_log` (one row per charge per India day: dedupe and "reminded today"), `redeem_telegram_link` (service role only, atomic). RLS scoped to `auth.uid()`; DB tests.
2. **U2 Bot core** (`telegram.server.ts`): API client (sendMessage, answerCallbackQuery), update handler (`/start <token>` redeem, `paid:<charge>` button to claim), secret-header check.
3. **U3 Webhook route** `/api/webhooks/telegram`.
4. **U4 Owner functions**: create/list/revoke invites, list recipients for the unpaid month, send reminders (sequential, about 25/s, stops on 429, revokes on 403).
5. **U5 UI**: Telegram batch dialog on Home, "Telegram invite link" section in the dancer panel.
6. **U6 Docs**: `.env.example`, handoff note.

## Unverified (no web access this run)
Telegram Bot API details are written from memory: `X-Telegram-Bot-Api-Secret-Token` header, `setWebhook` `secret_token`, `/start` payload (A-Za-z0-9_-, max 64), `callback_data` max 64 bytes, 403 when the user blocked the bot, 429 with `parameters.retry_after`. Check against a real bot before relying on it.
