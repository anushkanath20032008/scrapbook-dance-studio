---
title: Studio simplification pass (easy setup, shorter console, dance teacher login, public polish, Studio+ WhatsApp)
type: feat
date: 2026-10-28
topic: studio-simplify
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
status: requirements
---

# Studio simplification pass

## Goal Capsule

- **Objective:** A dance studio owner who signs up sees who owes them this month within minutes and almost no typing, runs the studio from a console they can understand without help, and can let teachers take attendance without sharing their own login.
- **Product authority:** The founder's brief of 2026-10-28 and the settled decisions below. Standing rules from `docs/handoff/2026-10-17-choreostudio-handoff.md` hold: fees are ledger-only, billing fields are server-managed, database changes only add, published git history is never rewritten.
- **Active scope:** One program in five parts that ships as one pull request: easy setup (R1 to R6), a shorter console (R7 to R9), the Dance teacher login (R10 to R14), a clearer public site (R15 to R16), and Studio+ automated WhatsApp (R17 to R22).
- **Open blockers:** Studio+ sending cannot be tested live until the founder's Meta Business account, number 9319260524 and an approved message template exist. Reading handwriting needs an Anthropic API key from the founder.

## Product Contract

### Summary

Setup gets three ways in (a photo of the paper register, a pasted or uploaded list, typing), all ending on one review table, then Overview. The console menu shrinks to about five items by grouping money screens and studio settings. The Dance teacher login built on `feat/instructor-role` is finished and gains a make-up class planner. The public site gets stronger section headings and visible separation between sections. Studio+ studios can switch on automated WhatsApp reminders sent from the ChoreoStudio business number, with owner review, delivery status and failure handling.

### Problem Frame

Owners run on paper registers, WhatsApp chats and memory. Today the app asks them to type every dancer, batch and fee before it shows anything, so the first session ends before the app is useful. Nine overlapping menu items (Billing, To verify, Month end, Messages, Insights and more) make it hard to know where a task lives. Only the owner can sign in, so teachers cannot take attendance without the owner's password. On the public page, headings like About and Contact blend into the cream background and sections run together. Automated WhatsApp is the main reason to pay for Studio+, and it is not wired up.

### How This Work Fits Together

<!-- ce-section: work-relationships -->

This plan covers all five parts together because they share one release and one console. The relationships below are the current understanding, not a roadmap.

- Easy setup
  - Shares the review table pattern with the existing paste import in `src/components/console/paste-dancers.tsx`.
  - Enables a useful Overview sooner, which the shorter console then presents.
- Shorter console
  - Depends on the Dance teacher login only for hiding menu items by role.
- Dance teacher login
  - Builds on `feat/instructor-role` (migration 0021, applied to the live database).
- Public site polish
  - Can proceed independently of the others.
- Studio+ WhatsApp
  - Builds on the existing queue, worker and senders in `src/lib/reminders.server.ts` and `src/lib/whatsapp.server.ts`.
  - Still to decide: when the founder turns on Studio+ checkout, which stays off in this plan.

### Actors

- A1. Studio owner: signs up, imports dancers, runs fees, invites teachers.
- A2. Dance teacher: signs in with a limited login to take attendance and plan make-up classes.
- A3. Dancer: an adult who never signs in. Receives WhatsApp reminders and has a private "I've paid" link.
- A4. Visitor: reads the public site before signing up.
- A5. Platform: the sender and delivery-status jobs for Studio+.

### Key Decisions

- **Dancers are adults who never log in; no guardian wording.** (session-settled: user-directed — chosen over a dancer portal and a child-plus-guardian model: all dancers are adults.) Governs R10, R17.
- **Student money never moves through the app.** (session-settled: user-directed — chosen over processing dancer payments through Dodo or a UPI gateway: compliance-heavy and out of scope.)
- **Without Studio+ automation, the owner sends every reminder by their own action.** (session-settled: user-directed — chosen over automatic scheduled reminders: the owner sees who will be messaged first.) Governs R17, R19.
- **The notebook photo, pasted list and typing all end on one review table.** (session-settled: user-approved — proposed after the founder said records may be in a physical notebook: handwriting reads imperfectly, so nothing is saved unreviewed.) Governs R1, R4.
- **Studio+ checkout stays off.** (session-settled: user-directed — chosen over selling Studio+ now: the feature is not ready.) Governs R17.
- **Studio+ WhatsApp is built now and stays dormant until keys exist.** (session-settled: user-directed — chosen over waiting for Meta approval before building: the founder wants the bot implemented.) Governs R17 to R22.

### Requirements

**Easy setup**

- R1. A new owner can add dancers from a photo of a paper register page, a pasted list, an uploaded spreadsheet or by typing, and all four end on the same review table.
- R2. From a photo, the app proposes each dancer's name, phone number and monthly fee when present on the page; the owner can fix, remove or add rows before anything is saved.
- R3. A photo is used only to read the page and is not kept; the upload screen says so in plain words.
- R4. Nothing from a photo, list or file is saved until the owner confirms the review table.
- R5. Batch names found in the data create batches and put each dancer in theirs; a fee amount found creates or reuses the matching fee plan.
- R6. After confirming, the owner lands on Overview showing who owes this month, and the setup checklist lists only the steps still missing.

**Shorter console**

- R7. The daily menu has about five items: Overview, Dancers, Money, Attendance, and Studio.
- R8. Money holds billing, items to verify, and month end; Studio holds batches, fee plans, messages, team and insights.
- R9. Existing links to the old pages keep working by redirecting to their new place.

**Dance teacher login**

- R10. An owner can invite a Dance teacher by link, and the UI calls the role "Dance teacher".
- R11. A Dance teacher sees only batches, dancer names and attendance; they never see phone numbers, fees, payments, claims, reminders, account or billing.
- R12. The owner sees their teachers on a Team page and can remove one at any time, which ends that teacher's access.
- R13. A Dance teacher can plan a make-up class: pick a batch, a date, and the dancers who missed; the owner can see these plans.
- R14. The teacher limits in R11 hold at the database, not only in the screens.

**Public site**

- R15. Section headings on the public site (About, Contact and the others) are visibly stronger than body text and distinct from the background.
- R16. Each public section is visibly separated from the next by a divider, band or tinted block, in the existing retro style.

**Studio+ WhatsApp**

- R17. Automated WhatsApp reminders are available only to studios on an active Studio+ plan and only when that studio has switched them on.
- R18. Reminders are sent from the ChoreoStudio business number 9319260524 using an approved message template with the dancer's name, studio name, amount and due date.
- R19. Before anything is sent, the owner reviews the recipient list and can remove dancers; dancers marked "don't send reminders" are never sent to.
- R20. Each reminder shows a status (queued, sent, delivered, failed) with the reason for a failure, and delivery updates arrive from the provider.
- R21. A failed send is retried a limited number of times and then shown to the owner, who can still use tap-to-send from their own number.
- R22. While keys are missing, every Studio+ WhatsApp control says automation is not switched on yet and tap-to-send keeps working.

### Acceptance Examples

- AE1. Covers R1, R2, R4. Given a photo of a register page with 12 names, when the owner uploads it, then 12 rows appear for review; nothing exists in Dancers until they press Add all.
- AE2. Covers R11, R14. Given a Dance teacher signed in, when they open a dancer, then they see a name only; a direct request for that dancer's fees or phone is refused by the database.
- AE3. Covers R12. Given an owner removes a teacher, when that teacher reloads the app, then they are signed out of the studio.
- AE4. Covers R17, R22. Given a Regular studio or missing keys, when the owner opens Messages, then no automated option is offered and tap-to-send still works.
- AE5. Covers R19. Given 20 unpaid dancers with 2 marked "don't send reminders", when the owner reviews, then 18 are listed as recipients and the 2 are shown as skipped with the reason.
- AE6. Covers R9. Given a bookmark to the old Billing page, when opened, then it lands on the Money section.

### Success Criteria

- A studio owner with a photographed register reaches "who owes this month" in under five minutes with no typed fields except fixes on the review table.
- A new owner finds any daily task from a menu of about five items without help.

### Scope Boundaries

**Deferred for later**

- Reading attendance history (grids of ticks) from a notebook photo.
- Turning on Studio+ checkout.
- Telegram bot setup.

**Outside this product's identity**

- A dancer portal or dancer logins.
- Moving dancers' fee money through the app.

### Dependencies / Assumptions

- Studio+ sending depends on the founder completing Meta Business verification, adding number 9319260524 to a WhatsApp Business Account, and getting a template approved.
- Reading handwriting depends on an Anthropic API key held in the host's environment settings; that key is the founder's to add.
- The make-up class planner records who missed which class and when the make-up will be; it does not message dancers and does not change fees. This is the builder's reading of the founder's words.
- Changing menu names and where screens live is acceptable because old links redirect (R9).

### Outstanding Questions

**Deferred to Planning**

- Which spreadsheet formats to accept (CSV, XLSX, or both).
- How the reminder status updates reach the app from each provider.
- Exact review table columns and defaults when a field is missing from a photo.

### Sources / Research

- Existing reminder queue and senders: `src/lib/reminders.server.ts`, `src/lib/whatsapp.server.ts`, `docs/plans/2026-10-17-2305-feat-whatsapp-reminders-plan.md`.
- Existing paste import: `src/components/console/paste-dancers.tsx`, `src/lib/bulk-dancers.server.ts`.
- Teacher login already built on `feat/instructor-role`: `drizzle/migrations/0021_instructors.sql`, `src/routes/app.team.tsx`, `src/routes/app.class.tsx`, `src/routes/join.tsx`.
- Fee due day and back-dated fees: `drizzle/migrations/0020_fee_due_day.sql`.
