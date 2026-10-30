# Live end-to-end pass, 30 Oct 2026 (choreostudio.live, production)

Method (compound-engineering style): plan the paths, run them live in Chrome, trace each failure to the query or
function behind it, fix what is small, and record the lesson so the next pass starts further along.

## Fixed this pass
- Google sign-in looped back to /login: Supabase held a stale Google client secret (auth log: `invalid_client`). Replaced; sign-in now lands on /app.
- Admin and console still said "Waitlist": now "Studio enquiries" (PR #7).
- Archived dancer counted in batch dancer counts and listed for attendance: batch counts and getRoster (PR #7) and the `batch_day` SQL function (migration 0021) now skip archived dancers, unless they already have a mark that day.
- International checkout: Dodo Adaptive Currency, local currency pre-selected, approximate local prices on the pricing cards (PR #8). Confirmed live: checkout offers INR and USD, 249 INR = 2.61 USD.

## Verified correct
Overview totals reconcile (billed 20,500 - collected 8,700 = overdue 11,800); month-end "How it was paid" equals Collected (cash 4,200 + UPI 4,500); fee due day and days-overdue; set-up checklist counts; plan dancer counts; batch counts.

## Fixed after the pass (PR: arrears, +GST, no-fee count, dismiss)
- Open items 1-4 below are fixed: Overview shows earlier-month arrears (`earlier_arrears`), pricing cards say "+ GST", the no-fee count only includes dancers whose fee plan covers the month (`dancers_awaiting_fee`), and a queued reminder can be dismissed (`dismiss_reminder`). Migrations 0021-0023, applied to production.

## Open (as found)
1. **Earlier-month arrears are invisible on Overview.** Overview is scoped to one month. Bhagavath owes Sept 5,000 + Oct 5,000 but October shows 5,000, and the reminder asks for 5,000. Add an "Earlier months: X" line and include arrears in reminders.
2. Prices on the site and checkout are ex-tax: checkout adds 18% GST (249 -> 293.82). Say "+ GST" on the pricing cards.
3. September view says "3 dancers have no fee for September 2026" for dancers who joined later; it should only count dancers who had joined by then.
4. A reminder queued on 17 Oct (Bindu) is still "Not Sent" on Messages; stale queue entries should be dismissible.
5. Bindu has an attendance mark but belongs to no batch (left after being marked); fine for history, worth a label.
6. Production still runs Dodo in test mode until the live API key, webhook secret, mode and product ids are switched together.
7. Leftover test data: `zz-test` rows in another studio; fee plan names "lalala" and "xyz".

## Lessons
- A rule applied in one query (archived dancers hidden) must be applied everywhere the same set is read: list, count, roster, SQL functions. Search for every reader when adding a filter.
- A displayed total needs its scope in the label. "Missing in all" on a one-month view reads as everything owed.
- Currency shown on the site is a hint; the payment provider's checkout is the source of truth for the final amount and tax.

## Dodo live switch (30 Oct)
Live API key, webhook secret, mode and live product ids set in Vercel production; redeployed to pick them up. Live webhook: https://www.choreostudio.live/api/webhooks/dodo. Products: Regular pdt_0Nqq3dimNcgV5LaVJwhrI, Studio+ pdt_0Nqq3dembDDjqSJi64GvX.
Redeployed again after correcting the product id and mode variables.
