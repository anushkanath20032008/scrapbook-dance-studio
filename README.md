# Choreo Studio

Choreo Studio is a scrapbook-style operations app for independent dance studios in India: fees, attendance, batches and WhatsApp reminders in one place. Live at [choreostudio.live](https://www.choreostudio.live).

## Who it's for

**Studio owner.** Finds the landing page, joins the founding-studios waitlist or opens **Studio account**, signs in (email or Google), saves studio details, and picks a Choreo Studio subscription plan. Day to day, the owner manages students, guardians, batches, attendance, each student's fee plan, ledger payments, and WhatsApp reminders.

**Family.** Parents and students don't install anything or create an account. They get a WhatsApp message with a link showing upcoming classes, attendance, charges, payments and balance.

## How billing works

There are two separate kinds of money in Choreo Studio:

- **Studio subscription (Dodo Payments).** The studio pays Choreo Studio for the software: Regular ₹249/month (the `starter` plan id) and Studio+ ₹479/month (`studio`), after a free first month that needs no card. The older Growth plan is no longer sold but still works for existing subscribers. Checkout is created by the server function `createSubscriptionCheckout` in `src/lib/billing.functions.ts`. The Dodo API key and product IDs never reach the browser, and a studio cannot edit its own plan or billing status.
- **Student fees (ledger-only).** Choreo Studio records what each student owes and what the studio says it received by cash, UPI or bank transfer. It does not process those payments.

Fee plans are separate from batches. A batch says where a student dances; a fee-plan assignment says what that student owes. Two students in the same batch can pay different amounts, and past ledger charges keep the plan and amount that created them.

## Stack

| Piece | Role |
| --- | --- |
| TanStack Start, React, TypeScript, Vite | Web app and server functions |
| Supabase | Authentication, application data, and row-level security. Waitlist writes go through validated server functions; owner-only data sits behind authenticated row policies and a separate role table |
| Vercel | Hosts the web app. Pushes to `main` deploy automatically to choreostudio.live |
| Render | Heavy background jobs, such as scheduled WhatsApp reminders and retries |
| Dodo Payments | Choreo Studio's own studio subscriptions only |
| Lovable | Visual editor, synced with this repository |

## Local development

```sh
npm install
npm run dev
```

Checks:

```sh
npm run lint
npm run test
npm run build
```

## Environment variables

Copy `.env.example` to `.env.local` for local work (it's untracked, so secrets stay out of git). In production, set them in Vercel under Project → Settings → Environment Variables.

| Variable | Where it's used |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server functions |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser client (publishable values only) |
| `DODO_PAYMENTS_API_KEY` | Server only. Creates checkout sessions |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Server only. Verifies the signature on Dodo webhooks |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Webhook, reminder job and the public family view |
| `RENDER_JOB_SECRET` | Server only. Bearer secret the scheduler sends to the reminder job |
| `WHATSAPP_PROVIDER_URL`, `WHATSAPP_PROVIDER_TOKEN` | Server only. The WhatsApp provider the reminder job posts to. Unset means reminders stay queued |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` (default) or `live_mode` |
| `DODO_PAYMENTS_STARTER_PRODUCT_ID`, `DODO_PAYMENTS_GROWTH_PRODUCT_ID`, `DODO_PAYMENTS_STUDIO_PRODUCT_ID` | Server only. One Dodo subscription product per plan |
| `PUBLIC_APP_URL` | Base URL for the checkout return link, e.g. `https://www.choreostudio.live`. Falls back to the origin of the incoming request |

If a plan's product ID or the API key is missing, choosing that plan shows a "not available for checkout yet" message instead of failing silently. A studio with a live subscription can't start a second checkout; one whose subscription has expired (cancelled, back on the waitlist) can subscribe again.

`plan` and `billing_status` only change through the Dodo webhook (below), which writes with the service role. Owners can edit their contact details but never their plan or billing state.

## Backend

Everything is a TanStack Start server function (`src/lib/*.functions.ts`) that loads its logic from `src/lib/*.server.ts` inside the handler, so no secret reaches the browser bundle. Rules that must never be bypassed (the ledger, attendance, reminders, billing state) live in SQL (`drizzle/migrations/0003` to `0006`) behind row-level security, and are tested against a real in-process Postgres.

| Area | What it does |
| --- | --- |
| Directory | Guardians, students, batches with dated rosters, fee plans assigned per student (separate from batch membership) |
| Ledger | Monthly charges and payments the studio records (cash, UPI, bank). ChoreoStudio never processes student payments. Charges keep the plan and amount that created them; entries are corrected by voiding with a reason, never edited |
| Attendance | One mark per student per class date, only for students on that batch's roster |
| Reminders | `queueReminders` adds a WhatsApp reminder for each due or overdue charge (once per charge per day). The send job delivers them with retries |
| Family view | Studios create a private link per guardian; the page behind it shows classes, attendance, charges, payments and balance. Only a hash of the link is stored, and it can be revoked |
| Billing | `POST /api/webhooks/dodo` turns verified Dodo events into the studio's plan and status |

### Reminder job

`POST /api/jobs/send-reminders` sends one batch of due reminders. Schedule it every few minutes (for example a Render cron job) with the header `Authorization: Bearer <RENDER_JOB_SECRET>`. Failed sends are retried with growing delays and give up after five attempts. If the provider settings are missing the job answers 503 and leaves every reminder queued. Creating the schedule is a deployment step, not part of the code.

### Dodo webhook

In the Dodo dashboard add a webhook pointing to `https://<your domain>/api/webhooks/dodo` with the subscription events, and copy its signing secret into `DODO_PAYMENTS_WEBHOOK_KEY`. The signature is checked on the raw body before anything is read. Each event is applied once, only if it is newer than the last one applied, and only for the studio's own subscription.

### Payment claims and screenshots

A dancer can report a payment from their private link (`/family/<token>`). A claim changes no balance until the owner confirms it under **To verify**; confirming runs the same amount-versus-owed gate as any payment, and the owner's own bank or UPI statement, matched by reference number, is the source of truth. A screenshot is optional: it uploads straight to the private `claim-screenshots` storage bucket (PNG, JPEG or WebP, up to 5 MB, created by migration `0013`) through a one-time signed URL, is viewed by the owner through a 60-second signed URL, and is deleted when the claim is decided.

`POST /api/jobs/purge-screenshots` deletes screenshots of decided claims and of claims left pending for over 30 days. Schedule it daily with the same header as the reminder job (`Authorization: Bearer <RENDER_JOB_SECRET>`). Have a lawyer review the privacy notice on the family page before real dancers' screenshots are collected.

### Database changes

The migrations in `drizzle/migrations` are additive. Apply `0003` onward (currently to `0013`) to the database, then run `drizzle/verify/rollout-checks.sql` against it: it must return no rows. Apply the migrations before deploying the code that uses them.

## Security

- Never commit API keys, webhook secrets or Dodo product IDs. The tracked `.env` is managed by Lovable and holds only Supabase **publishable** values; don't add secrets to it. Put secrets in Vercel's environment variables, or in an untracked `.env.local` locally.
- Never prefix a secret with `VITE_`; Vite exposes those to the browser.
- This repository is public. If a secret has ever been committed to it, treat it as leaked: rotate it in the provider's dashboard (Supabase, Dodo Payments, WhatsApp provider) and update Vercel, even after deleting it from the code. Git history keeps the old value.
- The repository is connected to Lovable: don't force-push or rewrite published history.

## WhatsApp reminders and owner nudges

Reminders you queue in the console are sent by `POST /api/jobs/send-reminders`; the owner email nudge is `POST /api/jobs/owner-nudge`. Call both from your scheduler (the reminder job every few minutes, the nudge once a day) with `Authorization: Bearer <RENDER_JOB_SECRET>`. With nothing configured the console falls back to tap-to-send chats and the jobs send nothing.

**WhatsApp (Meta Cloud API).** Set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` and optionally `WHATSAPP_TEMPLATE_LANGUAGE` (default `en`). Create two approved utility templates, `fee_due_reminder` and `fee_overdue_reminder`, whose body uses these variables in order: `{{1}}` guardian name, `{{2}}` dancer, `{{3}}` studio, `{{4}}` amount, `{{5}}` month, `{{6}}` due date. Example body: "Hi {{1}}, a reminder from {{3}}: {{2}}'s fee for {{5}} ({{4}}) is due on {{6}}. Thank you!"

**Owner nudge email (Resend).** Set `RESEND_API_KEY`, `NUDGE_FROM_EMAIL` (a sender Resend has verified) and `PUBLIC_APP_URL`. The owner is emailed on a due date and every Monday while any dancer is unpaid this month.

**Vobiz instead of your own number.** Vobiz (a Meta-approved provider) can supply the WhatsApp number, so reminders do not come from a personal phone. Set `VOBIZ_AUTH_ID` and `VOBIZ_AUTH_TOKEN` (console.vobiz.ai), `VOBIZ_CHANNEL_ID` and `VOBIZ_WABA_ID`. It is used before the Meta settings when all four are present. Submit the same two templates through Vobiz.
