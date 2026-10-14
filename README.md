# Choreo Studio

Choreo Studio is a scrapbook-style operations app for independent dance studios in India: fees, attendance, batches and WhatsApp reminders in one place. Live at [choreostudio.live](https://www.choreostudio.live).

## Who it's for

**Studio owner.** Finds the landing page, joins the founding-studios waitlist or opens **Studio account**, signs in (email or Google), saves studio details, and picks a Choreo Studio subscription plan. Day to day, the owner manages students, guardians, batches, attendance, each student's fee plan, ledger payments, and WhatsApp reminders.

**Family.** Parents and students don't install anything or create an account. They get a WhatsApp message with a link showing upcoming classes, attendance, charges, payments and balance.

## How billing works

There are two separate kinds of money in Choreo Studio:

- **Studio subscription (Dodo Payments).** The studio pays Choreo Studio for the software: Starter ₹999/month, Growth ₹1,999/month, Studio+ ₹3,999/month. Checkout is created by the server function `createSubscriptionCheckout` in `src/lib/billing.functions.ts`. The Dodo API key and product IDs never reach the browser, and a studio cannot edit its own plan or billing status.
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

Copy `.env.example` to `.env` for local work. In production, set them in Vercel under Project → Settings → Environment Variables.

| Variable | Where it's used |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server functions |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser client (publishable values only) |
| `DODO_PAYMENTS_API_KEY` | Server only. Creates checkout sessions |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Server only. Reserved for verifying Dodo webhooks |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` (default) or `live_mode` |
| `DODO_PAYMENTS_STARTER_PRODUCT_ID`, `DODO_PAYMENTS_GROWTH_PRODUCT_ID`, `DODO_PAYMENTS_STUDIO_PRODUCT_ID` | Server only. One Dodo subscription product per plan |
| `PUBLIC_APP_URL` | Base URL for the checkout return link, e.g. `https://www.choreostudio.live`. Falls back to localhost in development |

If a plan's product ID or the API key is missing, choosing that plan shows a "not available for checkout yet" message instead of failing silently.

## Security

- Never commit API keys, webhook secrets or Dodo product IDs. The tracked `.env` is managed by Lovable and holds only Supabase **publishable** values; don't add secrets to it. Put secrets in Vercel's environment variables, or in an untracked `.env.local` locally.
- Never prefix a secret with `VITE_`; Vite exposes those to the browser.
- This repository is public. If a secret has ever been committed to it, treat it as leaked: rotate it in the provider's dashboard (Supabase, Dodo Payments, WhatsApp provider) and update Vercel, even after deleting it from the code. Git history keeps the old value.
- The repository is connected to Lovable: don't force-push or rewrite published history.
