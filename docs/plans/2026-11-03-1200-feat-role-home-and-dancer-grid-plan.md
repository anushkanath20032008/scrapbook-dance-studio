---
title: Role home pages with tiles, and a spreadsheet-style dancer entry grid
type: feat
status: ready-for-work
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
date: 2026-11-03
---

# Role home pages with tiles, and a spreadsheet-style dancer entry grid

## Goal Capsule

Give the studio owner and the dance teacher each a home page of tiles that leads to every menu they can use, and replace "name + number" dancer entry with an editable grid (rows and columns the owner can add, remove and reorder) that collects fuller details and ends on the existing review step.

## Research (similar products)

- Glofox / Mindbody: one dashboard with calendar, payments and attendance entry points; nothing tile-level published, so we borrow the idea only.
- Jackrabbit: a *Quick Registration* form for staff that is deliberately not all-required, plus studio-defined extra fields. Takeaway: staff entry is fast and lenient; extra fields are optional and configurable.
- Quickbase / Oracle home-page patterns: a role gets its own home; critical actions and alerts on top, insights middle, rare links at the bottom; dashboards suit frequent goals.
- Indian tools (Classplus, Teachmint): fee tracking and reminders, no strong add-student pattern found.
- Not verified: Gymdesk, Zen Planner, Teamup layouts (searches returned nothing usable).

## Product Contract

### Settled (carried)
- Dancers are adults who never log in; no guardian wording. Money never moves through the app.
- Anything entered by photo, paste, upload or typing ends on one review table; nothing saves until the owner confirms.
- Teachers have no table access; teacher data comes only through `instructor_*` functions. Owner sees a superset of teacher screens.
- No health notes. Additive-only DB changes.

### R1 Owner home (`/app`)
- R1.1 Tiles for: Dancers, Payments (Billing, Payments to check, Month end, Insights), Attendance, Studio (Batches, Fee plans, Make-ups, Team, Account), plus Messages when a provider is configured. Each tile shows one live number or status (e.g. "12 unpaid", "3 to check", "2 batch requests").
- R1.2 Existing month totals and setup checklist stay; tiles sit under an "Needs you today" strip (payments to check, teacher batch requests, unpaid count).
- R1.3 Tile order follows how an owner's day goes; rarely used links (Account, Insights) are smaller.

### R2 Teacher home
- R2.1 Teacher lands on a home with tiles: Take attendance, My batches, Make-ups, Suggest a batch. Each shows a count (today's classes, pending requests, upcoming make-ups).
- R2.2 Reuses the teacher guided tour; the teacher menu gains a "Home" item. Default landing changes from Attendance to Home.
- R2.3 Tiles only link to pages the teacher is allowed; enforcement stays server-side.

### R3 Dancer entry grid
- R3.1 A grid on Dancers ("Add dancers") where each row is a dancer and each column is a field. Typing, tab/enter navigation, paste from Excel/Sheets/notebook list, and add/delete row.
- R3.2 Columns the owner can show or hide and reorder: Name (required), Phone, Batch, Fee plan / monthly fee, Joined on, Email, Emergency contact (name + phone), Note. Name stays locked on. Column choice is remembered per browser.
- R3.3 Adjustable rows and columns: add or remove rows, resize column widths, show/hide and reorder columns.
- R3.4 Per-row validation inline (bad phone, duplicate phone, missing name, unknown batch); invalid rows are flagged, valid rows can still be saved.
- R3.5 "Review" shows the same confirm table as the photo/paste import; nothing is saved before confirmation. Photo and paste fill the grid instead of a separate textarea.
- R3.6 Edit later uses the existing dancer panel with the same fields.

### Assumptions (unresolved forks, defaulted)
- A1 Fields to collect: email, joined on, batch, fee plan, emergency contact, note. Date of birth omitted; health notes excluded.
- A2 Emergency contact is optional and owner-visible only.
- A3 Grid is a lightweight in-house component (no spreadsheet library) to keep the bundle small; paste-to-fill via the clipboard `text/plain` tab/newline format.
- A4 Home tiles are not user-customisable in v1.
- A5 Batch-request count badge on the Studio tile is included.

## Implementation Units

### U1 Nav data and tile model
- Extend `src/lib/console-nav.ts` with `ownerTiles` and `teacherTiles` (id, label, hint, `to`, optional `badgeKey`). Keep `consoleGroups` unchanged; derive tiles from it where possible so the menu and home cannot drift.
- Test: every tile `to` exists in the router and appears in the matching nav list; teacher tiles are a subset of teacher-allowed pages.

### U2 Home counts
- Add a server function `getHomeCounts` (owner) in a new `src/lib/home.functions.ts` / `home.server.ts` using existing queries: unpaid count, claims to check, pending batch requests, today's batches. Teacher variant uses existing `instructor_*` functions only; no new table access.
- Tests in `src/test/` with `fakeSupabase`; DB test only if a new SQL function is added (not planned).

### U3 Owner home UI
- `src/components/console/home-tiles.tsx` (shared tile card with badge, colour via tokens so the `ux/colour` branch merges cleanly). Wire into `src/routes/app.index.tsx` below the "Needs you today" strip; keep month totals and setup checklist.

### U4 Teacher home
- New route `src/routes/app.home.tsx` (or role branch in `app.index.tsx` since teachers cannot use owner Overview); update `instructorItems` in `src/routes/app.tsx` and the post-login redirect to land on Home; update guided-tour copy.

### U5 Schema additions (additive)
- Migration `0031_student_details.sql`: nullable `email`, `joined_on date`, `emergency_name`, `emergency_phone`, `note` on `students` with length checks. No policy changes (owner-only rows already).
- Update `src/integrations/supabase/types.ts`, `src/lib/schemas.ts` (studentInput + bulk row schema), `bulk-dancers.server.ts` insert, DB test for check constraints and RLS (teacher cannot read new columns; they have no table privileges).
- Apply live via Supabase `apply_migration` before deploy.

### U6 Entry grid component
- `src/components/console/dancer-grid.tsx`: controlled rows state, column config (`id`, label, width, visible, order) persisted in `localStorage` with try/catch; keyboard nav; clipboard paste parser in `src/lib/grid-paste.ts` (tab/newline, header-row detection, column mapping by header name). Row add/delete, column resize via drag handle, column picker popover.
- Pure helpers (`parseGridPaste`, `validateRows`) unit-tested in `src/test/`.

### U7 Wire to import and review
- Replace the textarea in `paste-dancers.tsx` with the grid; photo result fills grid rows. Reuse `addableDancers` / review table / `bulkAddDancers`; extend row type with the new fields. Keep `MAX_PASTED_DANCERS`.
- Update `student-form.tsx` and `student-panel.tsx` with the new fields (progressive disclosure: "More details").

### U8 Copy, privacy, verification
- Privacy Notice: list the new dancer fields and that they are owner-held. No health data.
- Verify: typecheck, `npx vitest run`, `npm run build`, then browser test of owner home, teacher home (phone width too), grid paste and review. Commit in the worktree, rebase on main, push.

## Risks
- Grid on phones: horizontal scroll inside the grid only, never the page; offer a card-per-row fallback under 640 px.
- Teacher home counts must not leak owner data; keep to `instructor_*` functions.
- `ux/colour` branch touches `month-totals.tsx` and `styles.css`; keep new CSS in its own block to avoid conflicts.

## Ready for Planning Check
Scope, roles, fields, assumptions and units are stated; open product choices are recorded as A1-A5. Next: `ce-work` on this file starting with U1.
