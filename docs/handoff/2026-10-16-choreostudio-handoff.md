---
artifact_contract: "ce-handoff/v1"
created_at: "2026-10-16T11:00:00Z"
title: "ChoreoStudio: backend done, owner console in progress"
summary: "Backend is built and tested; the studio owner console is being built one user-tested slice at a time, U1 done and awaiting the user's test."
keywords: ["choreostudio", "owner-console", "supabase", "lovable", "dodo", "handoff"]
cwd: "C:\\Users\\Anushka\\code\\scrapbook-dance-studio"
resume_focus: "Get the user's result on U1 (sign-in and console shell), then build U2 (guided setup) per the console plan."
repository: "github.com/anushkanath20032008/scrapbook-dance-studio"
repo_root_sha: "2a9cd64146d39262523126e6992738ffb6050dfe"
branch: "feat/studio-subscription-pricing"
head: "26524188dd502df9c8d55d1da0253f8dbb1b1d23"
worktree_path: "C:\\Users\\Anushka\\code\\scrapbook-dance-studio"
---

# ChoreoStudio handoff

## Where to work

Open Claude Code in `C:\Users\Anushka\code\scrapbook-dance-studio` (machine-local path, a normal git clone). Do not use the OneDrive copy at `C:\Users\Anushka\OneDrive - Masters' Union\Masters Union\Term 2\AI in Business 2\ChoreoStudio`; it is an older, separate copy used only to read the dashboard mock (`index.html`, `app.js`), `roadmap.md` and the design-direction files. A third copy at `C:\Temp\ChoreoStudio-git-check` served the user's localhost:8085 preview and has not received any of the work below.

## What this is

ChoreoStudio (choreostudio.live) is an operations app for dance studios: students, guardians, batches, fee plans, a ledger of payments the studio records, attendance, WhatsApp fee reminders, and a private family link per guardian. The user is a Masters' Union student with a course deadline; production-ready by the 15th was the stated aim. The user is the product owner and tests each slice by hand. Stack: TanStack Start (server functions), Supabase on Lovable Cloud (Postgres, RLS, auth), Vercel hosting, Render for background jobs, Dodo Payments for studio subscriptions. The repo is synced to Lovable.

## Standing rules (user-directed)

- Student fees are ledger-only: ChoreoStudio never processes student payments.
- `plan` and `billing_status` on `studio_profiles` change only server-side (webhook, service role); owners edit contact fields only.
- Waitlist owner access is a separate role table (`user_roles`, `has_role`), never an email check in the client.
- Never rewrite pushed git history (Lovable-synced). Do not commit `.env`, keys or product IDs. Keep secrets out of the client bundle: server logic lives in `*.server.ts` loaded by dynamic import inside server-function handlers.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; PR bodies end with the Claude Code generated-with line.
- Build and test one slice at a time and ask the user to test it before starting the next (user-directed, this is the working rhythm).

## State of the work

| Area | Status |
|---|---|
| Studio subscription pricing (landing, `/account`, Dodo checkout) | Done, earlier in session |
| Backend: directory, ledger, attendance, reminders and WhatsApp job, family links and view, Dodo webhook, rollout checks, bundle-secret test | Done and tested (174 tests passing at the time) |
| Live database | Migrations `0003` to `0006` applied to the live Lovable database on 2026-10-16; rollout checks returned no rows; the one waitlist row is untouched. `0007` onward do not exist yet |
| Owner console U0 (live database) | Done |
| Owner console U1 (sign-in page, `/app` shell) | Built and committed (`2652418`); typecheck, lint, 8 tests and build pass; pages return 200 on the dev server. Waiting for the user's manual test result |
| Owner console U2 to U8 | Not started |

Nothing is pushed. The branch is 29+ commits ahead of `origin/main`; the push fails because there is no stored GitHub sign-in in the agent's environment. The user must push (for example `git push origin HEAD:main`, or push the feature branch) from their own signed-in terminal. Pushing to `main` deploys to Vercel and syncs back to Lovable.

## Read these first

- `docs/plans/2026-10-16-1556-feat-studio-owner-console-plan.md`: the current plan. Product Contract (R1 to R15, flows, acceptance examples, legal notes), Planning Contract (KTD1 to KTD11), units U0 to U8 each with a user test gate, Verification Contract, Definition of Done. Authoritative for what to build next.
- `docs/plans/2026-10-16-1148-feat-studio-operations-backend-plan.md`: the backend plan; explains why the SQL is shaped as it is (KTD1 to KTD13).
- `AGENTS.md`: Lovable and security rules for this repo.
- `README.md`: backend map, environment variables, reminder job and Dodo webhook setup.
- `drizzle/migrations/0003` to `0006` and `drizzle/verify/rollout-checks.sql`: the schema and the read-only safety check.
- `src/routes/app.tsx` and `src/routes/login.tsx`: the console shell and sign-in page just built. `src/routes/account.tsx` still has its own sign-in form and plan cards (left in place, now linking to `/app`).
- Dashboard mock for visual reference (machine-local): `C:\Users\Anushka\OneDrive - Masters' Union\Masters Union\Term 2\AI in Business 2\ChoreoStudio\index.html` and `app.js` (nav: Overview, Students, Batches, Billing, Attendance, Fee plans, Messages).

## Decisions made with the user in this session

- Owner console is the first slice; the student/family portal and the cover page with a demo video are separate later brainstorms (user chose this).
- Home screen opens on the unpaid list (days overdue, Remind and Record payment per row), money totals above it (user chose).
- Setup is guided, one record at a time; spreadsheet import deferred (user chose).
- Reminders are sent only by the owner's click after reviewing recipients; automatic scheduling deferred (user chose).
- Payment gate (user asked, agent designed): a reported payment is a claim until the owner confirms it; the amount is compared with what is owed (exact, part, excess needing a tick); amount plus UTR reference required for UPI or bank, screenshot optional, deleted once decided; the owner's own bank or UPI statement is the source of truth. A lawyer's review of the privacy notice is recommended before real guardians use it. Legal summary (not legal advice) is in the plan's "Legal and privacy notes".
- Agent calls the user has not explicitly confirmed: no grace period on days overdue; scheduled sessions counted from batch weekdays; five pending claims per guardian; 30-day screenshot purge backstop.

## Open items and unanswered questions

- The user's last message about the cover page was cut off ("on the cover page, I see that…"); ask what they meant. Cover page and demo video are a later brainstorm.
- Demo video: the user suggested ElevenLabs. ElevenLabs makes voice, not video, and no ElevenLabs connector is available. Runway is connected but the account is on the free plan with no video models. Realistic route: a screen recording of the finished console with an ElevenLabs voiceover.
- "Last page" layout the user said they like: never identified (candidates: the design file's "Recommended page layout", the Riso direction layout, a Stitch screen).
- The 8085 preview copy at `C:\Temp\ChoreoStudio-git-check` never received the wedge/zigzag removal; offered, no answer.
- The user asked for read-only Supabase, Vercel and GitHub connectors and was given setup pointers; none connected yet. Stitch and the Dodo API connector need the user's authorization.
- The multi-agent code review was not run on the backend work; a single inline review was done (one real bug found and fixed). The browser test and compound-learnings steps were skipped. The planned document review of the console plan was also skipped.

## Environment and sharp edges

- Run the real compiler with `node node_modules/typescript/bin/tsc --noEmit -p .`. `npx tsc` is a stub here, and earlier "no type errors" claims made with it were invalid.
- Tests: `npx vitest run` (about 40 seconds, jsdom by default; database tests use `// @vitest-environment node` and an in-process Postgres under `src/test/db/`). Lint only touched files: `npx eslint <files>`; whole-repo lint fails on untouched Lovable files. Format with `npx prettier --write <files>`. Build: `npm run build` (also regenerates `src/routeTree.gen.ts`).
- Strict TypeScript: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature` (use `process.env["NAME"]`).
- The Bash tool dies on very long heredocs; write long files with the Write tool.
- Supabase grants everything to anon and authenticated on new tables by default, so migrations REVOKE first. `unwrap()` in `src/lib/studio.server.ts` throws on null data; use a null-tolerant helper for optional rows.
- Dev server: `npm run dev` serves on `http://localhost:8080` against the real Lovable Cloud database (publishable keys in the tracked `.env`, managed by Lovable). Sign-in needs email confirmation.
- Lovable project id for the database tool: `09a1009a-b5e9-44c7-b625-29b3deccba78`. Its `query_database` runs any SQL including writes; apply migrations only with the user's go-ahead.

## Environment variables still to set in Vercel (user task)

`SUPABASE_SERVICE_ROLE_KEY`, `RENDER_JOB_SECRET`, `WHATSAPP_PROVIDER_URL`, `WHATSAPP_PROVIDER_TOKEN`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_API_KEY`, the three `DODO_PAYMENTS_*_PRODUCT_ID` values, `PUBLIC_APP_URL`. In Dodo, add a webhook to `/api/webhooks/dodo`. A scheduler (for example Render cron) must call `POST /api/jobs/send-reminders` with `Authorization: Bearer <RENDER_JOB_SECRET>`; until a WhatsApp provider is configured, reminders stay queued.

## Plausible next steps

One path: get the user's U1 test result (checklist is in the plan's U1 and was given in chat: register, confirm email, sign in, Google sign-in, forgot password, phone-width menu, signed-out redirect), fix anything they report, then build U2 (guided setup: fee plans, batches, students, checklist) and stop for their test; continue U3 to U8 the same way.

Alternatives, if the user redirects: ask the user to push first; or start the student/family portal brainstorm; or start the cover page and demo video work.

## Skills that may help

`ce-work` (build a unit from the plan), `ce-plan`, `ce-brainstorm`, `ce-code-review`, `ce-test-browser`, `ce-commit-push-pr`, `ce-handoff resume`.
