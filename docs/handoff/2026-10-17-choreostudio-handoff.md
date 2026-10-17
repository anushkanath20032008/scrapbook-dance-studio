---
artifact_contract: "ce-handoff/v1"
created_at: "2026-10-17T13:30:00Z"
title: "ChoreoStudio: owner console built, waiting on a push and the user's hand test"
summary: "U0 to U8 are built, verified and reviewed on feat/studio-subscription-pricing against the user's own Supabase project. Nothing is pushed: GitHub sign-in needs the user. U3 to U8 still need the user's hand test."
keywords: ["choreostudio", "owner-console", "supabase", "handoff", "pull-request"]
cwd: "C:\\Users\\Anushka\\code\\scrapbook-dance-studio"
repository: "github.com/anushkanath20032008/scrapbook-dance-studio"
branch: "feat/studio-subscription-pricing"
resume_focus: "Get the branch pushed and a PR opened, then the user's hand test of U3 to U8, then the member portal."
---

# ChoreoStudio handoff (2026-10-17)

Supersedes `docs/handoff/2026-10-16-choreostudio-handoff.md` (its rules still hold; this file records what changed).

## State

- The owner console is built: sign-in, guided setup (fee plans, batches, dancers, checklist), Home (month totals, who hasn't paid), record payment with the amount-versus-owed gate, billing and voids, To verify (dancer payment claims, screenshots), reminders you review and queue, attendance, insights. Plan: `docs/plans/2026-10-16-1556-feat-studio-owner-console-plan.md` (updated to match the built code).
- Database and auth now run on the user's own Supabase project `ngwvmuorxzahlfbktmum` (Mumbai). Migrations `0000` to `0014` are applied there; rollout checks return no rows; the Supabase security advisor has only by-design warnings left. The old Lovable Cloud project is no longer used by local runs.
- Local runs point at the new project through the untracked `.env.local` (publishable keys plus `SUPABASE_SERVICE_ROLE_KEY`). The tracked `.env` still holds the old Lovable values; do not edit it (Lovable manages it).
- 284 tests, typecheck and build pass; the bundle-secret scan passes after a build.
- Dancers are adults: the UI says dancer (name, phone); each dancer has one hidden `guardians` row.

## Not done

- **Nothing is pushed.** The branch is about 50 commits ahead of `origin/main`. Pushing from the agent hangs on Git Credential Manager and `gh` is not installed. The user pushes the feature branch (not `main`) from a signed-in terminal: `git push -u origin feat/studio-subscription-pricing`, then opens a PR. Do not push to `main` until the PR is reviewed; `main` deploys to Vercel and syncs to Lovable.
- **The user has passed U1 and U2 by hand. U3 to U8 are untested by the user.** The agent drove the real app in the built-in browser (signed in as the user): generate charges, the payment gate (excess needs a tick, part payment leaves the rest owed), Billing, a dancer link, a claim submitted from `/family/<token>`, confirm in To verify, Remind preview, attendance, Insights; all matched. Screenshot upload, Google sign-in and a real WhatsApp send were not exercised.
- Google sign-in needs the Google provider set up in Supabase (Authentication, Providers) and a Google OAuth client with callback `https://ngwvmuorxzahlfbktmum.supabase.co/auth/v1/callback`.
- Auth redirect URLs (`http://localhost:8080/**`, `https://choreostudio.live/**`) must be on the allow-list in Supabase for the reset link to work.
- Vercel environment variables are still the user's task (see the older handoff), plus the new Supabase URL, keys and service role key, and schedule `POST /api/jobs/purge-screenshots` beside the reminder job.
- Leaked-password protection is off in Supabase Auth (the dashboard toggle may need a paid plan).
- The member portal (dancers log in via a studio invite) is planned in `docs/plans/2026-10-16-1909-feat-member-portal-plan.md` (uncommitted, awaiting the user's answers to its open questions 5 and 6).

## Test data the agent created in the user's account (Oct 17)

October 2026 charges for the two test dancers (Bindu, Pushpak); a cash payment of 3,000 for Pushpak; a UPI payment of 1,000 for Bindu confirmed from a claim (ref TESTUTR0001); one attendance mark for Bindu on the Under 10 batch; one family link for Bindu, since revoked. Void the payments in Billing if the account should be clean.

## Review findings left for the PR (from the multi-agent review, run 20261017-181706-897f763b)

Verdict was Ready with fixes. The one confirmed finding (an uploaded screenshot with no tracked path) is fixed. Still open as residual risks:

- [ ] P3 — `purgeScreenshots` removes everything in one storage call and one update; after a long outage a big backlog could exceed request limits, and `handlePurgeJob` returns a bare 500 with no logging. Suggest batching and logging.
- [ ] P3 — Confirming or rejecting a claim swallows screenshot cleanup errors, so retention depends on the purge job being scheduled (documented, not enforced).
- [ ] P3 — `submit_payment_claim` has no idempotency token: a lost response plus a resubmit can create two pending cash claims (no reference to flag as a duplicate). Owner-reviewed.
- [ ] P3 — Pending claims older than 30 days lose their screenshot before the owner decides.
- [ ] Observation — a dancer who left a batch today still appears on that batch's roster for today (by design: `left_on >= date`), which can look like they are still on it.
- Coverage: cross-model pass not run (no peer CLI installed); review covered the console commits (1520c3c^..HEAD), not the earlier backend and pricing commits.

## PR description (paste into the pull request)

**Studio owner console (U0 to U8)**

Adds the owner console behind `/login` and `/app`: guided setup, Home with who hasn't paid and the money missing, the payment gate and Billing, dancer payment claims with a To verify queue, owner-click reminders with a log, attendance, and a monthly trend. Dancers are adults (no guardians). Auth and database move to the owner's own Supabase project (migrations 0007 to 0014).

Verification: typecheck, 284 tests, build and the bundle-secret scan pass; rollout checks are clean on the live project; U1 and U2 were hand-tested by the owner; U3 to U8 were driven end to end in the real app by the agent (see the handoff). U3 to U8 still need the owner's hand test.

Not in this PR: the member portal, Google sign-in setup, WhatsApp provider, Vercel environment variables.

## Unapplied review findings

The checkbox list above under "Review findings left for the PR". Review run context: run `20261017-181706-897f763b`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
