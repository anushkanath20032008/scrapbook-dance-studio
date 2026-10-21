# Telegram reminder bot: built, not yet set up (2026-10-21)

Plan: `docs/plans/2026-10-21-feat-telegram-reminder-bot-plan.md`. Branch: `feat/studio-subscription-pricing`. Nothing pushed, migration 0017 not applied.

## What it does
- Owner creates a **Telegram invite link** per dancer (dancer panel). The dancer taps it, presses Start, and is joined (single use, hashed token, revocable).
- Home has **Remind on Telegram** (appears only when the three env vars are set). The owner ticks recipients and presses Send. Nothing sends on its own. One Telegram reminder per charge per India day. Sends are paced at about 25 a second.
- Message text is the WhatsApp tap-to-send wording (`reminderText` in `src/lib/manual-reminders.ts`), with the dancer's own amount and due date.
- Each message has an **I've paid** button. It creates a pending payment claim (method other, reference "Telegram: I've paid") for what the ledger still shows owed. The owner confirms it in To verify; the payment gate is unchanged.
- A dancer who blocks the bot is marked disconnected on the next send.

## What you need to do
1. In Telegram, message **@BotFather**, send `/newbot`, pick a name and a username. Copy the token and the username.
2. Apply `drizzle/migrations/0017_telegram_reminders.sql` to Supabase (not applied by the agent).
3. In Vercel, add env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` (any random string of letters, digits, `_` or `-`). Redeploy.
4. Point Telegram at the webhook (use your own values; this call needs the token, so run it yourself):
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/api/webhooks/telegram&secret_token=<WEBHOOK_SECRET>`
5. Test with your own phone: create an invite for a test dancer, open it in Telegram, press Start, then Remind on Telegram on Home, then tap I've paid and check To verify.

## Verified here
Type-check, 357+ tests (webhook secret, join/redeem, send, I've paid claim, RLS and redeem in SQL), and the build pass.

## Not verified
The Telegram Bot API was not called and nothing was checked against current docs (no web access). Written from memory: the `X-Telegram-Bot-Api-Secret-Token` header, `setWebhook` `secret_token`, `/start <payload>` (payload limited to A-Z a-z 0-9 _ -, 64 characters), `callback_data` up to 64 bytes, 403 when a user blocked the bot, 429 with `retry_after`. The step-5 test on a real bot is the proof.

## Notes
- Send an invite privately to each dancer: it works once, so a link posted in a group is taken by the first person who taps it (the owner can revoke and recreate).
- A send of hundreds of dancers runs in one request; fine for a studio, but a very large batch could hit the host's time limit (split by picking fewer).
- `src/routeTree.gen.ts` gained the new webhook route (generated).
