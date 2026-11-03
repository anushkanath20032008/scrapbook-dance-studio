---
title: Studio table home: one place for dancers, payments, attendance and reminders
type: feat
status: requirements-only
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
date: 2026-11-03
---

# Studio table home

## Goal Capsule

Replace the tile home with one CRM-style table where an owner sees every dancer grouped by batch with fee, amount due, paid status and today's attendance, and can mark a whole batch paid or present, filter, and remind everyone who owes, without opening other pages. Assume the customer knows nothing: every action is visible, labelled in plain words, and needs no navigation.

Active scope: the Studio table (owner and teacher views), its bulk actions, side panels, and fixing content covered by dialogs. Not active scope: Instagram and WhatsApp enquiry import (next brainstorm; this plan only reserves a "New enquiries" chip that stays hidden until that work exists).

## Product Contract

### Settled (from the user)
- S1 One table is the value proposition: batch-wise dancers, who has not paid, their batch and amount. Layout is "A: Batch blocks": each batch is a collapsible block with its own header buttons (user chose A from three sketches).
- S2 Attendance is one tick per dancer on the home page; no separate page needed for the common case.
- S3 Bulk: "Mark all paid" and "All present today" per batch; reminders go to ticked dancers, not one by one through pages.
- S4 "Mark all paid" asks one confirmation that shows the total and asks cash or UPI, then offers a 10-minute Undo.
- S5 Filter chips: All, Unpaid only, Today's classes (plus Paid for checking).
- S6 Nothing may cover the content it is about; no dialog hides the dashboard, including in the demo.
- Carried: dancers are adults and never log in; student money never moves through the app (the app only records); teachers never see fees or payment status; additive-only DB changes; owner/teacher access enforced by role tables and row policies.

### Requirements
- R1 Home (`/app`) for the owner is the Studio table. Tiles are removed. Month totals stay as a slim summary line above the table.
- R2 Batch block header shows batch name, schedule, dancer count, paid count and total due, plus buttons: Mark all paid, All present today, Remind unpaid (n). Blocks collapse; collapse state is remembered per browser.
- R3 Row shows Name, Fee, Due, Status (Paid, Unpaid with amount, Part-paid), a Here-today tick, and a Remind button on unpaid rows. Clicking a name opens a side panel (not a centred dialog) with full details, payment history and edit.
- R4 Unpaid dancers are pre-ticked in the reminder step; "Remind ticked" shows who will be messaged before sending. Without Studio+ automation the owner's device opens one WhatsApp chat per dancer; the flow queues them so the owner taps once per dancer without leaving the table. Studio+ sends in one action (dormant until Meta keys exist).
- R5 "Mark all paid" records payments for every unpaid dancer in the block at their due amount, with the chosen method, one Undo within 10 minutes. Part-paid dancers are paid to full. Each row can still be unticked before confirming.
- R6 "All present today" marks the block's dancers for today's class; individual ticks can be flipped back. Only batches meeting today get the attendance column active; other days show the next class date.
- R7 Teacher home is the same table limited to their batches with no fee, due, or status columns and no payment or reminder buttons; they keep the attendance tick and can add a dancer to their batch.
- R8 Fees, payments to check, batches, fee plans, make-ups and team open as side panels from the table page or stay as short secondary pages; the left menu shrinks to Home and Settings plus the rare pages. No feature is removed.
- R9 Dialogs that cover the page are replaced by side panels or are repositioned so the table stays visible. The guided tour, terms gate and demo are audited: the tour points at elements without covering them, the terms gate is the only intentional blocker, and the demo opens on a filled table.
- R10 Empty state: a first-time owner sees a single clear action ("Add your first batch", then "Add dancers") instead of an empty table.
- R11 Desktop and phone: on a phone the table becomes stacked rows; header buttons stay reachable without horizontal page scroll.

### Acceptance examples
- AE1 Batch of 12 with 3 unpaid: tap Mark all paid, see "3 dancers, ₹6,000, cash or UPI", confirm; all rows show Paid, header shows 12/12, an Undo bar appears and reverses it.
- AE2 Filter "Unpaid only": only batches with unpaid dancers remain, rows show the amount, and Remind unpaid lists exactly those dancers.
- AE3 Teacher opens home: sees their batches and a tick per dancer; no money columns anywhere, including side panel.
- AE4 Demo opens: table is fully visible with nothing overlaid except a small pointer.

### Assumptions (unresolved, defaulted)
- A1 Reminder sending without Studio+ stays one tap per dancer because WhatsApp links open one chat at a time.
- A2 Menu keeps Settings and rarely used pages; exact grouping is a planning decision.
- A3 Undo is available for 10 minutes for bulk paid and bulk present.
- A4 The existing dancer entry grid is reused for adding dancers inside the table page.
- A5 No drag-and-drop in v1 except optional batch reordering; the CRM feel comes from grouping, filters and bulk actions.

### Deferred / next
- Instagram and WhatsApp enquiry import (Meta app review, WhatsApp Business number, Instagram professional account; Claude extracts name, phone, batch into a New enquiries row confirmed with one tick; paste or share fallback for personal WhatsApp).
- Studio+ one-action bulk WhatsApp send once Meta keys are supplied.

## Research (what exists, verified in the worktree)
- Per-dancer money state: `student_ledger_status(period)` returns student, charge, amount, outstanding, status, due date, fee plan. It has no batch; batch membership lives in `batch_members`. Owner reads these through `getLedgerStatus`.
- Payments: `recordPayment` (rpc `record_payment`) takes studentId, amountPaise, method (`cash|upi|bank|other`), paidOn, idempotencyKey; excess needs `acknowledgeExcess`. Undo is `voidPayment` (sets `voided_at`, needs a reason).
- Attendance: `markAttendance({batchId, date, marks[])`, `getBatchDay` (rpc `batch_day`), teacher versions `markInstructorAttendance`, `getInstructorBatchDay`.
- Reminders: `queueReminders`, `previewReminders`, `getReminderLinks`, and the WhatsApp batch UI in `whatsapp-batch.tsx` / `remind-dialog.tsx`.
- UI parts already there: `dancer-grid.tsx`, `unpaid-list.tsx`, `student-panel.tsx`, `record-payment.tsx`, `console-dialog.tsx` (centred dialog that covers the page), `sheet.tsx` in `components/ui` (side panel primitive), `guided-tour.tsx`.

## Key Technical Decisions
- KTD1 One server read builds the table: a new owner function `getStudioTable({period, date})` returns batches with members and each member's fee, outstanding, status, and today's mark. Reuses `student_ledger_status` and `batch_day` rather than new tables. Teacher variant `getTeacherTable` returns the same shape with money fields absent (not just hidden), built only from `instructor_*` functions, so fees cannot leak.
- KTD2 Bulk paid is a loop of existing `record_payment` calls inside one server function `markBatchPaid({batchId, method, paidOn, studentIds[], idempotencyKey})`, each with a derived idempotency key (key + student) so a retry never double-records. It returns the created payment ids for Undo.
- KTD3 Undo calls `voidPayment` for those ids with the fixed reason "Undone by owner"; allowed for 10 minutes by checking `created_at` in the server function. No schema change.
- KTD4 Bulk present reuses `markAttendance` with all marks; Undo re-sends the previous marks.
- KTD5 Row details and edit use `Sheet` (side panel) instead of `ConsoleDialog`. `ConsoleDialog` gets a `side` option so every existing dialog can move over without rewriting it.
- KTD6 Reminders: the table builds the ticked recipient list and hands it to the existing remind flow; the WhatsApp queue becomes an inline strip on the table ("Next: Meera, 2 left") instead of a dialog, so it never covers the table.
- KTD7 No database migration is needed for this plan (additive-only rule trivially holds). Batch-level "paid count" is computed in the read.
- KTD8 Menu: `console-nav.ts` keeps all routes reachable; Home and Settings lead, with the other pages grouped under "More". Existing pages stay and open from the table's side panels.

## Implementation Units

### U1 Table data and types
Add `src/lib/studio-table.server.ts` and `.functions.ts` with `getStudioTable`, `getTeacherTable` and a shared type in `src/lib/studio-table.ts` (batch → rows; pure helpers for per-batch totals, filter by unpaid/paid/today). Tests: pure helpers; fakeSupabase tests for the owner read; a teacher test asserting no money keys exist in the payload.

### U2 Bulk actions server side
Add `markBatchPaid`, `undoBatchPaid` (KTD2, KTD3) and a bulk-present wrapper. Tests: DB test (PGlite) that a retry with the same key creates no second payment, that undo voids exactly those payments, that undo after 10 minutes is refused, that a teacher cannot call the paid functions, and that excess/part-paid dancers pay to full.

### U3 Studio table component
`src/components/console/studio-table.tsx`: batch blocks (collapsible, state in localStorage), rows with status pill and Here-today tick, filter chips (All, Unpaid, Paid, Today's classes), header buttons per option A. Plain-language empty and loading states (R10). Phone layout stacks rows (R11).

### U4 Bulk confirm and undo UI
Confirm popover/inline panel for Mark all paid (total, count, cash or UPI, untick exceptions) and an Undo bar (10 min). Failure states: partial failure lists who failed and keeps the rest; nothing silently fails.

### U5 Reminders on the table
Pre-tick unpaid rows, "Remind ticked" shows recipients, inline send queue strip (KTD6). Reuse `previewReminders`/`getReminderLinks`; Studio+ path unchanged and dormant. Test the recipient selection logic as a pure helper.

### U6 Wire home and teacher home
`app.index.tsx` renders month summary + table; remove `HomeTiles` usage. Teacher home renders the teacher table (R7) with attendance only and "Add dancer" per batch (reuse `teacher-add-dancer.tsx`).

### U7 Side panels and menu
Add `side` mode to `ConsoleDialog` (KTD5); move student panel, record payment, remind, void and the setup dialogs to it. Update `console-nav.ts` and `app.tsx` (KTD8) with nav tests updated.

### U8 Hidden-content audit
Fix `guided-tour.tsx` so highlights never cover the target, confirm the terms gate is the only blocker, make the demo open on the filled table, and add a check that no console dialog renders over the table at 1280px and 390px. Verify in the browser at both widths.

### U9 Copy and verification
Plain wording pass (no jargon: "Here today", "Unpaid ₹2,000"). Typecheck, `npx vitest run`, `npm run build`, then a browser run of AE1–AE4 as owner and as teacher. Commit in the worktree, rebase on main, push (user signs in for pushes if needed).

## Sequencing
U1 → U2 → U3 → U4 → U5 → U6 (home goes live) → U7 → U8 → U9. U1–U6 are the minimum that delivers the user's core value; U7–U8 can ship right after.

## Risks
- Large batches: 300 dancers in one block; paginate rows inside a block past 100 and keep bulk actions on the full batch.
- Money safety: bulk paid must never double-record (KTD2 keys) and must show a total before confirming (S4).
- Teacher payload must contain no money keys (U1 test).
- Replacing tiles changes what existing owners see; keep the old pages reachable from the menu.
- Reminders still need one tap per dancer without Studio+ (A1); wording must say so plainly.

## Ready for Planning Check
Actors, outcome, scope, acceptance examples, assumptions and implementation units with tests are stated; layout decided by the user (option A). Document review skipped so the user can read it first.
