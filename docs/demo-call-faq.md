# Demo call cheat sheet: ChoreoStudio (for a studio owner)

Answers are written to be said out loud, from the studio owner's point of view. Every claim below is checked against the Terms, the Privacy Notice, or the live Supabase project (checked 2026-11-01). Anything not yet proven is marked **[say carefully]**.

## 1. The 30-second pitch
"ChoreoStudio is a fee and attendance register for dance studios. You see who has paid, who is due and who is overdue. When you want to remind someone, your own WhatsApp opens with their name and amount filled in, and you press Send. Your first 30 days are free with every feature and no card."

## 2. Everyday questions

**What does it cost?**
First 30 days free, no card. Then Regular (up to 50 active dancers) at ₹249 a month, or Studio+ (more than 50) at ₹479 a month, plus GST where it applies. Check the pricing on the page before the call. Prices can change for new customers any time. Existing subscribers get at least 30 days' notice before the next renewal (Terms 4).

**Does the money go through ChoreoStudio?**
No. Dancers pay you by your own UPI or bank. We never hold, move or process that money. A payment shows in the app only because you recorded it, or you confirmed a dancer's "I paid" note against your own bank statement (Terms 2).

**Do you message my dancers?**
No, not on your behalf. Reminders open in your own WhatsApp with the message filled in, and you send them (Terms 2). Automated WhatsApp sending is "coming soon". Don't promise a date.

**What if a dancer doesn't want messages?**
Mark them "don't send reminders". The app respects it. There is also an opt-out page for dancers.

**Can I cancel? Do I get a refund?**
Cancel any time from "Manage billing". It takes effect at the end of the period you paid for. Fees already paid aren't refundable unless the law requires it (Terms 5).

**What if I have more than 50 dancers?**
You move to Studio+. Existing records are never deleted because of a limit, but you can't add or restore dancers beyond your plan (Terms 4).

**Who can see my dancers' phone numbers and fees?**
Only you, and any instructor you add, who sees only their own batches. Other studios cannot see your records.

**Can my dancers see anything?**
Yes, only if you choose. You can give a dancer a private link or invite, and they see only their own fees, attendance and payments. The link is cancellable by you any time.

**Can I get my data out?**
Yes. Ask for an export of your records any time (Terms 11). After you close the account you have 30 days to ask for one.

## 3. Trust questions (the important ones)

### "How do you keep my data private?"
- **Separate by studio, enforced in the database.** Row-level security is switched on for all 23 tables and 45 policies decide who can read each row. Even a bug in the screen can't show another studio's data. This is the main protection, and the Privacy Notice says the same (section 9).
- **Dancer contact details are not public.** Nothing is readable without signing in. Public pages (home, blog) never touch studio data.
- **Private links store only a scrambled hash.** The link itself is shown once and can't be recovered from our database. You can cancel it.
- **Payment screenshots** sit in a private storage bucket (not public), and are deleted when you decide the claim, or after 30 days if undecided.
- **We don't sell data or use it for ads** (Privacy 2). Dancers' data is used only to run the service for you.
- **Card and UPI details never reach us.** They go to Dodo Payments.

### "How do you keep it safe and correct (integrity)?"
- Fee and balance amounts are calculated by the database from the charges and payments you entered, so every screen shows the same number.
- Money is stored as whole paise (integers), so there are no rounding errors.
- Payment events from the billing provider are processed once each. A repeated or out-of-date event is ignored (the database function checks this).
- Plan and billing fields can only be changed by our server, never by the account owner. Nobody can give themselves a plan.
- Records are archived, not hard-deleted, in normal use.

### "Will it always be available? Can I rely on you?"
Be honest here, because the Terms are:
- Terms 11: "We work to keep the Service running and your data safe, but we do not promise it will always be available or free of errors." We do reasonable backups, and you should keep your own copy of anything important. We export on request.
- It runs on established providers: Vercel (hosting) and Supabase (database and sign-in), both with their own redundancy.
- Say: "I can't promise 100% uptime, nobody honestly can. What I can promise is that your records are in a managed Postgres database, your fees don't depend on my laptop, and you can export them at any time. If something breaks, you email me and I answer within 3 working days for formal complaints, much faster for outages." **[say carefully: don't quote an uptime percentage, there is no SLA.]**
- **[Check before the call]** Confirm the Supabase plan and whether daily backups or point-in-time recovery are on (Supabase dashboard, Database, Backups). If PITR is off, say "daily backups" only if they're on. Don't claim more.

### "Where does my data physically go?"
In plain order:
1. **Your browser or phone** talks to the website over HTTPS (encrypted in transit, HSTS on).
2. **Vercel** serves the app and runs our server functions. These hold the secret keys, never the browser.
3. **Supabase** (Postgres + sign-in), in the **Mumbai region (ap-south-1)**. This is where dancers, fees, payments and attendance are stored. Supabase encrypts storage at rest as a managed provider. **[provider claim, say "our database provider encrypts it at rest"]**.
4. **Supabase Storage** holds payment screenshots in a private bucket.
5. **Dodo Payments** handles your subscription payment. It sends us only status events (active, cancelled), never card numbers.
6. **WhatsApp / Telegram** see a message only because you send it from your own account.
7. **Zoho** is our support mailbox. **Microsoft Clarity** records page clicks on public pages only if a visitor says Allow.

Honest caveat: Terms/Privacy say "some providers may handle data outside India". Today the app's server functions run in Vercel's US region (iad1), while the data is in Mumbai. A config change to run them in Mumbai (`vercel.json` region `bom1`) is prepared and goes live when it's deployed. Until then say "stored in Mumbai, and the app server may process it in transit elsewhere". **[confirm after deploy]**

### "Is it processed or analysed?"
Only to run the app: totals, who is overdue, reminder text. No ads, no selling, no profiling, no AI training on dancers' data. **[Confirm: say this only if it is true for every feature you've shipped, including any photo-reading feature. The database has a `photo_reads` table, so check what that feature sends and to whom before saying "no third party".]**

### "What about my dancers' privacy law rights (DPDP Act)?"
- You are the **Data Fiduciary** for your dancers' data. We are the **Data Processor** acting on your instructions (Terms 6).
- We promise: process it only to provide the service, keep it protected, keep studios separate, use only the listed providers, help you answer a dancer's access/correction/erasure request, and tell you **within 72 hours** of becoming aware of a breach that affects your data.
- Your part (Terms 7): get the dancer's consent where needed, collect only what you need, honour opt-outs, and don't enter anyone under 18 without a parent's or guardian's verifiable consent. The app is built for adults.

### "What if I leave?"
Cancel and ask us to close the account. You have 30 days to ask for an export. We then delete your studio's data, dancers included, within a further 30 days, except what the law requires us to keep. Backups are overwritten in the normal course (Terms 13).

### "What if you shut down or something goes wrong?"
Terms 15: our liability is limited to what you paid in the last 3 months (₹1,000 if you've paid nothing), except where the law doesn't allow limits. Terms 14: the service is "as is". You can export your data any time, so keep a monthly export. Don't oversell beyond this.

### "Who do I complain to?"
support@choreostudio.live is the Grievance Officer. We acknowledge within 3 working days and aim to resolve within 30 days. For data-protection matters, the Data Protection Board of India is the next step.

## 4. Questions you can't answer yet: say so
- "Do you have an uptime guarantee or SLA?" No.
- "Do you have a mobile app?" Only if true today. Say "it works in the phone browser" if that's what it is.
- "Are you SOC 2 / ISO certified?" No. Say "I rely on certified providers, and the setup is described in our Privacy Notice."
- "When will automatic WhatsApp reminders arrive?" No date.
- Anything about tax or legal advice: "The app records what you enter. It isn't accounting or tax advice (Terms 2)."

## 5. Before the call, check these 4 things
1. Supabase backups: plan, daily backups, PITR on or off.
2. Production is deployed (blog, security headers, Mumbai region) so what you show matches this sheet.
3. Pricing on the live page matches the numbers above.
4. What the photo-reading feature sends to any third party.
