---
title: WhatsApp reminders and owner nudges - Plan
type: feat
date: 2026-10-17
topic: whatsapp-reminders
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
status: ready
---

# WhatsApp reminders and owner nudges - Plan

## Goal Capsule

- **Objective:** A studio owner can message every unpaid dancer on WhatsApp after reviewing the list, and is prompted on a schedule before unpaid fees pile up. Reminders really send once the studio's Meta account is approved, and fall back to the existing tap-to-send chat until then.
- **Product authority:** The user's brief of 2026-10-17 and the settled decisions below. Standing rules from the handoff hold: fees are ledger-only, billing fields are server-managed, nothing is applied to the database or pushed without the user's go-ahead.
- **Active scope:** Real WhatsApp sending through Meta's Cloud API, "Remind all unpaid" with a review step, per-dancer send status, and the owner's scheduled nudge (email plus a Home banner). The dancer portal is a separate area, planned in `docs/plans/2026-10-16-1909-feat-member-portal-plan.md`, and is not active scope here.
- **Open blockers:** Meta business verification and message template approval are the user's task and can take days. Real sending cannot be verified end to end until they finish.

## Product Contract

### Summary

The existing reminder queue and send worker connect to Meta's WhatsApp Cloud API using approved templates. The owner reviews who will be messaged and sends in one tap, one dancer or everyone unpaid. The owner is nudged by email on due dates, and weekly while anyone is unpaid, and sees an unpaid banner with a Remind all button on Home.

### Problem Frame

Owners chase unpaid dancers one WhatsApp chat at a time and nothing prompts them when fees go unpaid. The console can queue reminders, but no real provider is configured, so queued reminders never leave the app.

### Actors

- A1. Studio owner: reviews recipients, sends, receives nudges.
- A2. Dancer: adult recipient of the WhatsApp reminder.
- A3. Platform: the scheduled jobs that send queued reminders and owner nudges.

### Key Decisions

- **The owner reviews and clicks send; nothing messages dancers automatically.** (session-settled: user-directed — chosen over automatic scheduled reminders: the owner sees who will be messaged first.) Governs R2, R3.
- **Student money never moves through Choreo Studio.** (session-settled: user-directed — chosen over processing payments through Dodo or a UPI gateway: compliance-heavy and out of scope.)
- **Dancers are adults; each is their own contact.** (session-settled: user-directed — chosen over a child-plus-guardian model: all dancers are adults.)
- **Provider is Meta's WhatsApp Cloud API.** (session-settled: user-approved — recommended over Twilio, India resellers and staying on tap-to-send: free to start and no middleman; costs days of approval.) Governs R1.
- **The owner is nudged by email and an in-app banner, not WhatsApp.** (session-settled: user-approved — recommended over a WhatsApp nudge and banner-only: needs no extra approved template and still prompts when the app is closed.) Governs R5, R6.

### Requirements

**Sending**

- R1. Queued reminders are sent through the WhatsApp Cloud API with the studio's approved templates, and each ends as sent or failed with the reason kept.
- R2. Until WhatsApp is configured, the console says so and keeps the existing tap-to-send chat.
- R3. Dancers marked "don't send reminders" are never messaged and appear in the review list with that reason.

**Remind everyone**

- R4. "Remind all unpaid" lists every unpaid dancer with their amount, lets the owner remove any, and queues all the rest on one confirm.
- R5. The reminder log shows each dancer's status, and a reminder is never sent twice for the same charge and kind.

**Owner nudges**

- R6. The owner gets an email on a charge's due date and once a week while any dancer is unpaid, naming the count and total owed, and linking to Home.
- R7. Home shows an unpaid banner with the count, the total owed and a Remind all button; the banner is hidden when nobody is unpaid.

### Key Flows

- F1. Owner opens Home, sees "12 unpaid, ₹24,000", taps Remind all, reviews the list, removes one dancer, confirms; reminders send and statuses appear in the log.
- F2. A dancer marked "don't send reminders" is left out of the list with a visible reason.

### Acceptance Examples

- AE1. Covers R2. With no WhatsApp keys set, the review step says messages are not sent automatically and offers the chat links.
- AE2. Covers R3, F2. A dancer marked "don't send reminders" appears as skipped with that reason and is never queued.
- AE3. Covers R5. Confirming Remind all twice in a row queues each dancer once.
- AE4. Covers R6. With nobody unpaid, no weekly email is sent.

### Scope Boundaries

**Deferred for later**

- Sending reminders to dancers automatically on a schedule.
- WhatsApp nudges to the owner.
- Two-way WhatsApp conversations and delivery receipts beyond sent or failed.
- The demo video.

**Not active scope here**

- The dancer portal and invites, owned by the approved member-portal plan.

### Dependencies / Assumptions

- The studio completes Meta business verification and template approval (user task). Assumption: two templates, fee due and fee overdue, cover the reminders.
- Assumption: the existing per-dancer "don't send reminders" flag is the consent control (opt-out); a stricter opt-in is deferred.
- Assumption: owner nudge emails use an email provider the user configures; which one is left to planning.

### How This Work Fits Together

<!-- ce-section: work-relationships -->

This plan covers WhatsApp reminders and owner nudges. The surrounding breakdown is current understanding, not a roadmap.

- Dancer portal (`docs/plans/2026-10-16-1909-feat-member-portal-plan.md`)
  - Can proceed independently of this plan.
  - Shares the dancer record and the claim form.

## Planning Contract

- **Reuse:** the queue (`reminders`, `queue_fee_reminders`, `preview_fee_reminders`), the worker `runReminderJob` and its `WhatsAppProvider` interface, `RemindDialog`, and the Home "Remind everyone overdue" button already exist and satisfy R4 and R5. This plan adds a Meta provider, the owner nudge and the Home banner.
- **KTD1. Meta provider is another `WhatsAppProvider`, chosen by env.** `WHATSAPP_PHONE_NUMBER_ID` plus `WHATSAPP_ACCESS_TOKEN` select it; the generic HTTP provider stays as fallback. Template body parameters are sent in the order guardian, student, studio, amount, month, due date. Templates `fee_due_reminder` and `fee_overdue_reminder`, language `WHATSAPP_TEMPLATE_LANGUAGE` (default `en`). Governs R1, R2.
- **KTD2. The nudge is a daily job route called by the same scheduler as the reminder job.** It reads a service-role-only SQL summary per studio, emails the owner through Resend (`RESEND_API_KEY`, `NUDGE_FROM_EMAIL`), and sends on a due date or on Mondays while anyone is unpaid. With no key it reports not configured and sends nothing. Governs R6.
- **KTD3. The Home banner reads the existing home report.** No new query. Governs R7.

## Implementation Units

- U1. **Meta Cloud API provider.** Files: `src/lib/whatsapp.server.ts`, `src/lib/reminders.server.ts` (`getMessagingStatus`), tests in `src/test/whatsapp.server.test.ts`. Tests: payload shape and parameter order, 4xx not retryable, 429 and 5xx retryable, env selection and fallback.
- U2. **Owner nudge.** Files: migration `drizzle/migrations/0015_owner_nudge.sql` (`owner_nudge_summary`, service role only) plus journal entry, `src/lib/owner-nudge.server.ts`, `src/routes/api/jobs/owner-nudge.ts`, tests `src/test/owner-nudge.server.test.ts` and `src/test/db/owner-nudge.test.ts`. Tests: send rule (due date, Monday, nobody unpaid), no key means nothing sent, summary scoped per studio.
- U3. **Home banner.** Files: `src/routes/app.index.tsx`. Shows count, total owed and a Remind all button; hidden when nobody is unpaid.
- U4. **Docs.** README section: Meta setup, template text, env vars, scheduling both jobs.

## Verification Contract

Typecheck, `npx vitest run`, `npm run build` pass; migration 0015 is written but not applied until the user approves; banner checked in the built-in browser.
