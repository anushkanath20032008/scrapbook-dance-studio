# ChoreoStudio launch checklist (things only the founder can do)

Written 2026-10-23. Code and database work is on branch `release/production-ready`; none of it is live until it is
merged into `main`. Order matters: do 1 to 4 before you tell anyone to sign up.

## 1. Merge the release branch
Open a pull request from `release/production-ready` into `main` and merge it. Vercel redeploys in about two minutes.
Then hard-refresh choreostudio.live (Ctrl+Shift+R).

## 2. Make sign-up emails arrive (blocking)
Supabase's built-in sender is a testing mailer: it is rate-limited, often lands in spam, and may not deliver to
outside addresses. Real sign-ups need your own sender.
1. resend.com: sign up, Domains, Add Domain `choreostudio.live`. Add the DNS records it shows at Name.com (My Domains,
   choreostudio.live, DNS Records). They sit on a subdomain and do not touch your Zoho mail. Click Verify.
2. Resend: API Keys, create one with sending access, copy it.
3. Supabase (project ngwvmuorxzahlfbktmum): Authentication, Emails, SMTP Settings, turn on Custom SMTP.
   Host `smtp.resend.com`, port `465`, username `resend`, password = the API key, sender `support@choreostudio.live`,
   sender name `ChoreoStudio`. Save.
4. Supabase: Authentication, URL Configuration. Site URL `https://choreostudio.live`. Redirect URLs:
   `https://choreostudio.live/**`, `https://www.choreostudio.live/**`, `http://localhost:8080/**`.
5. Supabase: Authentication, Providers, Google: turn on and add your Google OAuth client (callback
   `https://ngwvmuorxzahlfbktmum.supabase.co/auth/v1/callback`), or hide the Google button.
6. Supabase: Authentication, Sign In / Providers, turn on leaked password protection if your plan allows it.
7. Test: register with a real address, confirm the email arrives within a minute, sign in.

## 3. Take payments (Dodo Payments, start in test mode)
1. dodopayments.com: create the account and finish business verification (needed for payouts).
2. Products: create two monthly subscriptions, Regular at 249 and Studio+ at 479 (check that rupee pricing is
   offered; if not, decide how to price). Do not add a trial in Dodo: the free month is handled in the app.
3. Developer: API Keys (create one), Webhooks (add `https://choreostudio.live/api/webhooks/dodo`, select the
   subscription events, copy the signing secret).
4. Vercel, Project Settings, Environment Variables: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`,
   `DODO_PAYMENTS_ENVIRONMENT=test_mode`, `DODO_PAYMENTS_STARTER_PRODUCT_ID` (Regular),
   `DODO_PAYMENTS_STUDIO_PRODUCT_ID` (Studio+). Redeploy.
5. Test with Dodo's test card: choose a plan from the account page, pay, and check the plan changes to active.
   Then switch to live keys, live product ids and `DODO_PAYMENTS_ENVIRONMENT=live_mode`.
6. Turn on payment retries and a grace period in Dodo so a failed renewal does not lock a studio out at once.

## 4. Schedule the background jobs
Use cron-job.org (free). Each job is a POST with the header `Authorization: Bearer <RENDER_JOB_SECRET>` (the value
already set in Vercel).
- `https://choreostudio.live/api/jobs/purge-screenshots`: once a day. The Privacy Notice promises payment
  screenshots are deleted after 30 days; this job does it.
- `https://choreostudio.live/api/jobs/owner-nudge`: once a day at 9:00, only after Resend is set up
  (also add `RESEND_API_KEY`, `NUDGE_FROM_EMAIL=support@choreostudio.live` and `PUBLIC_APP_URL` in Vercel).
- `https://choreostudio.live/api/jobs/send-reminders`: only when automated WhatsApp is live. Not needed now.

## 5. Mailbox and legal
- Zoho: finish the DNS verification (CNAME at Name.com), reset the password, and confirm `support@choreostudio.live`
  receives mail. It is the contact address in the footer, Terms and Privacy Notice.
- Have a lawyer read the Terms and Privacy Notice. They are drafted in line with the DPDP Act 2023 but are not
  legal advice. Still to add: the legal entity name and address, and a named city for the courts.
- Check the Clarity dashboard after a day: only your public-page visits should appear, none from the console.

## 6. Switched off until you set it up (nothing breaks in the meantime)
- Telegram reminder bot: create the bot in @BotFather, add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
  `TELEGRAM_WEBHOOK_SECRET` in Vercel, apply migration `0017_telegram_reminders.sql`, set the webhook to
  `https://choreostudio.live/api/webhooks/telegram`. Its buttons stay hidden until the three variables exist.
- Automated WhatsApp (Studio+): needs a WhatsApp number that can be registered (a prepaid SIM works) and the Meta or
  Vobiz keys. Marked "coming soon" on the site.

## 7. After launch
- Watch Clarity recordings and your support inbox for the first 10 studios.
- Rotate any key that was ever pasted into a chat or committed.
