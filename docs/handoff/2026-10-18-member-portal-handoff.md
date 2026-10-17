---
title: "ChoreoStudio: dancer portal built, waiting on migration 0016, config and your hand test"
branch: "claude/infallible-spence-4e720b (on top of feat/studio-subscription-pricing @ fc61280)"
plan: "docs/plans/2026-10-16-1909-feat-member-portal-plan.md"
---

# Member (dancer) portal: handoff (2026-10-18)

Nothing is pushed, nothing is applied to Supabase. Types, tests and build pass.

## What was built (plan units M0 to M5)

- **M0 schema** `drizzle/migrations/0016_member_access.sql`: `member_invites`, `member_links`, `invite_attempts`, `payment_claims.submitted_via`, and definer functions `create_member_invite`, `redeem_member_invite`, `member_studios`, `member_view`, `member_claims`, `submit_payment_claim_member`. Rollout checks extended (`drizzle/verify/rollout-checks.sql`).
- **M1 owner invites**: "Dancer login" section in the dancer panel (invite 1/7/30 days, link + code shown once, replace, cancel, remove access) and a Joined/Invited badge in the Dancers list.
- **M2 join + sign-in**: `/join` (type the code), `/join/<secret>`, dancer sign-in by Google or emailed magic link (no passwords).
- **M3/M4 member view**: `/me` (studio list, skipped with one studio), `/me/<studioId>` (classes, attendance, fees with status, payments, balance, own claims).
- **M5 claims**: `/me/<studioId>/claim` using the same form as the family link (`src/components/claim-form.tsx`).
- The family link is unchanged apart from a line telling the dancer to ask the studio for a login invite. The login page's "I'm a dancer" tab now offers "Sign in as a dancer", "I have an invite code" and the private link code.
- Opening `/app` with a member-only account sends it to `/me` and no studio profile is created.

## Deliberate differences from the plan

- **No member SELECT policies on any table.** Members have no table privileges; every read and write goes through the definer functions above, which start from `auth.uid()` and the active `member_links`. Stricter than KTD3 and cannot widen an owner policy by union. The rollout checks flag any policy that mentions `member_links`.
- **At most one open invite per dancer** (re-issuing revokes the older one) instead of "five open"; plus 10 invites per dancer per hour.
- **One live login per dancer record** (partial unique index). To change who owns a record, the owner removes access first.
- No `requireMember` middleware: every member function runs on the dancer's own JWT and the database decides. The service-role client is used only to sign the screenshot upload URL, for the claim the database just created for that caller.
- The pending invite is kept in `localStorage` (not `sessionStorage`) so an emailed magic link opened in a new tab still redeems; it is cleared on use or failure, expires after a day, and is removed from the URL.
- `member_claims` lists the 20 newest claims; `member_view` shows 24 charges, 24 payments and 60 attendance rows per dancer.
- Review: the multi-agent `ce-code-review` was not run (its cross-model pass sends code off the machine); security paths were reviewed by hand and by the DB tests. A fresh review before merge is sensible.
- Not browser-tested: the flows need the migration applied and the Supabase settings below.

## What you must do

1. **Apply migration 0016** to project `ngwvmuorxzahlfbktmum` (SQL editor or MCP), then run `drizzle/verify/rollout-checks.sql`; it must return no rows.
2. **Supabase Auth settings**
   - URL Configuration > Redirect URLs: add `https://choreostudio.live/join`, `https://choreostudio.live/me` (and the same for any preview/localhost origin you test on).
   - Providers: Email on with magic links (OTP) allowed and signups enabled; Google on (already used by the owner login). Add the same redirect URLs in the Google OAuth client if you restrict them.
   - Custom SMTP is recommended: the default Supabase mailer is heavily rate-limited, which would throttle dancers' magic links.
3. **Vercel**: no new environment variables. `PUBLIC_APP_URL` (already used by family links) builds the invite link. Redeploy after merge.
4. Push the branch when you are ready (the agent cannot sign in to GitHub).

## Hand test (user gates)

1. Dancers > open a dancer > Dancer login > Invite to sign in. Copy link and code. Row shows Invited.
2. Open the link on a phone in a private tab; sign in with email link, then again with Google on another dancer. You land on `/me`.
3. Reuse the same link and a wrong code: both say "This invite is not valid." Six wrong codes in a minute are refused.
4. Compare the balance on `/me` with the console and with the family link for the same dancer.
5. "I've paid": send an exact and a part claim, decide them in To verify, confirm the dancer sees the outcomes. The five-waiting cap is shared with the family link.
6. Second studio: redeem another studio's invite with the same account; `/me` lists both.
7. Remove access in the console; the dancer's next load says no access. Re-invite works.
8. Sign in to `/app` with a dancer-only account: you are sent to `/me` and no studio profile appears in `studio_profiles`.

## Known limits

- Short codes (about 40 bits) are safe only with the throttle (5 failures a minute, 20 an hour, per account and per request source) and the invite's short life. The source comes from `x-forwarded-for`; account-level throttling still applies if that header is missing.
- A leaked invite link before it is redeemed lets the first person who redeems it in. The owner sees "Joined" at once and can remove access.
- The owner never sees a dancer's email or last sign-in.
- Notices to dancers (WhatsApp etc.) beyond the existing reminders, and members editing their contact details, are out of scope.
