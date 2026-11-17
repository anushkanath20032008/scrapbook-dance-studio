/** Blog posts as data, so they render the same on the server and need no build step or CMS. */
export type Block =
  | { t: "p"; text: string }
  | { t: "h2"; text: string }
  | { t: "h3"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "msg"; label: string; text: string }
  | { t: "note"; text: string };

export type Post = {
  slug: string;
  title: string;
  /** Meta title, kept near 60 characters. */
  metaTitle: string;
  description: string;
  date: string;
  readingMinutes: number;
  blocks: Block[];
  faq?: { q: string; a: string }[];
  sources?: { label: string; url: string; note: string }[];
  /** Slugs of other posts to link at the end. */
  related?: string[];
};

export const SITE = "https://www.choreostudio.live";

const p = (text: string): Block => ({ t: "p", text });
const h2 = (text: string): Block => ({ t: "h2", text });
const h3 = (text: string): Block => ({ t: "h3", text });
const ul = (...items: string[]): Block => ({ t: "ul", items });
const ol = (...items: string[]): Block => ({ t: "ol", items });
const msg = (label: string, text: string): Block => ({ t: "msg", label, text });
const note = (text: string): Block => ({ t: "note", text });

const DATE = "2026-11-17";

/* Shared sources, so every post cites the same pages the same way. */
const SRC = {
  superprof: {
    label: "Superprof, Cost of dance lessons in India (20 January 2026)",
    url: "https://www.superprof.co.in/blog/cost-of-dance-lessons",
    note: "Monthly group-class ranges by style for India as a whole. Not city-specific, and Superprof runs a tutor marketplace.",
  },
  ramis: {
    label: "Rami's Dance, BTM Layout, Bengaluru: class listing on mytribe.in",
    url: "https://mytribe.in/ramisdanceinc_btm/hip-hop-dance-classes",
    note: "Lists adult classes at ₹1,800 to ₹3,000 a month. Undated listing, one studio only.",
  },
  upi: {
    label: "Inc42, UPI MDR regime explained (15 September 2026)",
    url: "https://inc42.com/features/upi-mdr-regime-explained-heres-what-will-be-charged-after-oct-15/",
    note: "The 0.4% charge above ₹2,000, the ₹1 lakh a month small-merchant rule and the ban on passing the charge on. A news explainer, not the NPCI circular itself.",
  },
  sec22: {
    label: "CGST Act 2017, section 22: persons liable for registration",
    url: "https://www.knowyourgst.com/gstlaw/the-central-goods-and-services-tax-act-2017/22-persons-liable-for-registration-22",
    note: "The ₹20 lakh threshold, and ₹10 lakh for special category states. Section text reproduced by KnowYourGST.",
  },
  entry66: {
    label: "Taxo, Entry 66 exemption limited to educational institutions (2 May 2026)",
    url: "https://taxo.online/latest-news/02-05-2026-gst-exemption-under-entry-66-is-restricted-to-institutions-meeting-the-precise-definition-of-educational-institution-supplementary-coaching-institutes-fall-outside-its-a/",
    note: "Summary of a Gujarat advance ruling: coaching that is not an 'educational institution' does not get the Entry 66 exemption.",
  },
  masterminds: {
    label: "AAR Andhra Pradesh, Master Minds (AAR No. 08/AP/GST/2020)",
    url: "https://gstcouncil.gov.in/sites/default/files/AAR/aar_no.8-2020_mater_mind.pdf",
    note: "Advance ruling holding that a coaching provider is not an educational institution for the exemption. About exam coaching, not dance.",
  },
  dropoutCdc: {
    label: "CDC Stacks: study of women starting an exercise programme",
    url: "https://stacks.cdc.gov/view/cdc/192791/cdc_192791_DS1.pdf",
    note: "Cites dropout as high as 50% in the first 3 to 6 months of group exercise programmes. About exercise in general, not dance.",
  },
  dropoutOlder: {
    label: "Stiggelbout et al., Dropout from exercise programs for seniors (Journal of Aging and Physical Activity, 2005)",
    url: "https://research.ou.nl/en/publications/dropout-from-exercise-programs-for-seniors-a-prospective-cohort-s/",
    note: "Cites earlier reports of about 50% dropout in the first 6 months, mostly in the first 12 weeks. Its own group of 1,725 adults aged 50+ dropped out much less: 15% per 6 months.",
  },
  gbp: {
    label: "Google Business Profile Help: add or claim your Business Profile",
    url: "https://support.google.com/business/answer/2911778",
    note: "Google's own steps for creating a free listing on Search and Maps.",
  },
};

/* ------------------------------------------------------------------ */

const runStudio: Post = {
  slug: "how-to-run-a-dance-studio-in-india",
  title: "How to run a dance studio in India, by the numbers",
  metaTitle: "How to Run a Dance Studio in India, by the Numbers",
  description:
    "A worked month for a 60-dancer studio in Bengaluru: what comes in, what goes out, the break-even number, and the two thresholds (UPI and GST) a growing studio hits.",
  date: DATE,
  readingMinutes: 7,
  related: ["how-to-price-dance-classes-in-india", "upi-charges-on-dance-class-fees", "gst-on-dance-classes-in-india", "why-adult-dancers-quit-dance-classes"],
  blocks: [
    p("Most advice about running a studio stays vague: keep good records, look after your dancers, watch your money. This post does it with one studio's month, in rupees, so you can swap in your own figures and see where you stand."),
    p("The studio below is an example we made up. Its fee sits inside the range real Bengaluru studios list for adult classes (one BTM Layout studio lists ₹1,800 to ₹3,000 a month). The costs are placeholders. Replace every number with yours."),
    h2("The example studio"),
    ul(
      "One room in Bengaluru, six batches a week, about 10 dancers per batch: 60 dancers in total",
      "Fee: ₹2,500 a month for two classes a week, so 8 classes a month",
      "Rent ₹45,000, one part-time instructor ₹30,000, electricity and internet ₹6,000, cleaning, music and small repairs ₹9,000",
      "The owner teaches the other batches and is paid from whatever is left",
    ),
    h2("What it bills, what it collects"),
    p("Billed: 60 dancers × ₹2,500 = ₹1,50,000. Fixed costs: ₹45,000 + ₹30,000 + ₹6,000 + ₹9,000 = ₹90,000. On paper that leaves ₹60,000 for the owner."),
    p("Now the real month. Say 9 dancers have not paid by month end and 3 paid only half. Collected is 48 × ₹2,500 + 3 × ₹1,250 = ₹1,23,750. The owner's ₹60,000 has become ₹33,750. Nothing changed about the teaching. The gap between billed and collected took 44% of the owner's pay."),
    p("That gap is the first number to watch. Write billed and collected down every month, side by side. If collected stays below about 90% of billed two months in a row, fees need attention before anything else does."),
    h2("Your break-even number"),
    p("Divide fixed costs by the fee: ₹90,000 ÷ ₹2,500 = 36. This studio needs 36 paying dancers to cover its costs before the owner earns a rupee. Every paying dancer after the 36th is the owner's income."),
    p("Two things follow. Losing 5 dancers costs the owner ₹12,500 a month, more than a fifth of their pay. And a fee rise of ₹200 on 60 dancers brings in ₹12,000 a month, almost the same as keeping those 5 dancers. Here, keeping dancers and pricing are worth about the same, which is useful to know before you spend time on either."),
    h2("Capacity: where the room loses money"),
    p("If the room comfortably holds 15, six batches can hold 90 dancers. At 60, the studio uses two thirds of what it pays rent for. Look batch by batch. A batch with 14 is nearly full and may need a waiting list or a second slot. A batch with 5 costs almost as much to run as the full one. Ask whether its time or level is wrong before you cut it."),
    h2("Two thresholds a growing studio hits"),
    h3("UPI: ₹1 lakh a month"),
    p("Since 15 October 2026, UPI payments above ₹2,000 to a merchant account carry a 0.4% charge, paid by the business. Small merchants receiving up to ₹1 lakh a month by UPI QR stay at zero. This studio collects ₹1,23,750, so if most of it arrives by UPI it can cross that line. On a ₹2,500 fee, 0.4% is ₹10. Across 50 UPI payments that is ₹500 a month. Small, but worth knowing, and the studio may not pass it on to dancers. Our post on UPI charges has the details."),
    h3("GST: ₹20 lakh a year"),
    p("At ₹1,50,000 billed a month, the studio bills ₹18 lakh a year. Add a showcase and two workshops and it can cross ₹20 lakh, the point where GST registration becomes compulsory in most states. Keep a running yearly total from April. Our GST post has the details."),
    h2("The five numbers to write down each month"),
    ol(
      "Dancers enrolled",
      "Billed",
      "Collected, and collected as a percentage of billed",
      "Still owed, split into under 30 days and over 30 days",
      "Dancers who joined, and dancers who left",
    ),
    p("Ten minutes at month end, in a notebook or a spreadsheet, is enough. Compare each number with last month. The trend tells you more than any single month."),
    note("ChoreoStudio shows billed, collected and who is still owed for each month, and opens a WhatsApp reminder with each dancer's own amount that you send yourself. First month free, no card needed."),
  ],
  faq: [
    {
      q: "How many dancers does a dance studio need to break even?",
      a: "Divide your monthly fixed costs by your monthly fee. With ₹90,000 of costs and a ₹2,500 fee, you need 36 paying dancers before the owner earns anything.",
    },
    {
      q: "What should a dance studio owner track every month?",
      a: "Five numbers: dancers enrolled, amount billed, amount collected, amount still owed by age, and dancers who joined and left. Compare each with the previous month.",
    },
  ],
  sources: [SRC.ramis, SRC.upi, SRC.sec22],
};

/* ------------------------------------------------------------------ */

const upiCharges: Post = {
  slug: "upi-charges-on-dance-class-fees",
  title: "UPI charges on dance class fees from 15 October 2026",
  metaTitle: "UPI Charges on Dance Class Fees from October 2026",
  description:
    "Merchant UPI payments above ₹2,000 now cost the business 0.4%. What that means for a dance studio collecting monthly fees, with worked examples.",
  date: DATE,
  readingMinutes: 5,
  related: ["how-to-run-a-dance-studio-in-india", "how-to-price-dance-classes-in-india", "gst-on-dance-classes-in-india"],
  blocks: [
    p("Since 15 October 2026, some UPI payments to businesses carry a fee. Many monthly dance fees are above ₹2,000, which is exactly where the fee starts. Here is what changed, who it applies to, and what it costs a studio in rupees."),
    h2("What changed"),
    ul(
      "Person-to-merchant (P2M) UPI payments above ₹2,000 carry a merchant discount rate of 0.4%",
      "Payments of ₹2,000 or less stay free",
      "The business pays it. Merchants are not allowed to pass it on to the customer",
      "Small merchants receiving up to ₹1 lakh a month through UPI QR into their own bank account stay at zero",
      "A merchant above ₹1 lakh for three months in a row moves to the paid category",
      "Payments between people (P2P), such as to friends and family, stay free",
    ),
    p("These details come from Inc42's explainer of the new rules, published a month before they started. Check with your bank for the exact terms on your account."),
    h2("What it costs a studio"),
    p("0.4% of ₹2,500 is ₹10. Of ₹3,000, it is ₹12. A ₹1,800 fee costs nothing, because it is under ₹2,000."),
    p("Example: a studio with 50 dancers paying ₹2,500 each by UPI receives ₹1,25,000 a month, over the ₹1 lakh small-merchant line. If it stays there for three months, each payment costs ₹10: ₹500 a month, or ₹6,000 a year."),
    p("A studio with 35 dancers at ₹2,500 receives ₹87,500 by UPI, under ₹1 lakh. It pays nothing."),
    h2("What to do"),
    ol(
      "Ask your bank or payment app which category your UPI account is in: the small-merchant track or regular P2M.",
      "Add up how much comes in by UPI each month. If you are near ₹1 lakh, you now know why that number matters.",
      "Put the cost in your monthly costs. ₹500 on ₹1,25,000 is 0.4% of income, less than one dancer leaving.",
      "Do not add it to the dancer's fee. The rules do not allow it.",
    ),
    p("Splitting one fee into two payments of ₹2,000 or less to dodge the charge is not worth it. It doubles your reconciling work, and the bank sees both payments."),
    h2("What does not change"),
    p("Your dancers pay the same way they always did. Cash and bank transfers are not part of this change. The GST threshold is a separate rule, based on your total yearly income from every payment method, not on UPI alone."),
    note("ChoreoStudio records each payment as cash, UPI or bank transfer, so at month end you can see how much came in by UPI. First month free, no card needed."),
  ],
  faq: [
    {
      q: "Is there a charge on UPI payments for dance class fees?",
      a: "From 15 October 2026, merchant UPI payments above ₹2,000 carry a 0.4% charge paid by the business. Merchants receiving up to ₹1 lakh a month through UPI QR stay at zero.",
    },
    {
      q: "Can a dance studio pass the UPI charge on to dancers?",
      a: "No. The rules described in Inc42's explainer say merchants cannot pass the charge on to customers.",
    },
    {
      q: "How much does the UPI charge cost on a ₹2,500 fee?",
      a: "0.4% of ₹2,500 is ₹10. Fees of ₹2,000 or less are not charged.",
    },
  ],
  sources: [SRC.upi],
};

/* ------------------------------------------------------------------ */

const priceClasses: Post = {
  slug: "how-to-price-dance-classes-in-india",
  title: "How to price dance classes in India",
  metaTitle: "How to Price Dance Classes in India (with 2026 Ranges)",
  description:
    "What studios in India charge per month by style, how to work out your own floor price, what that means per class, and a fee-rise message you can send.",
  date: DATE,
  readingMinutes: 6,
  related: ["how-to-run-a-dance-studio-in-india", "upi-charges-on-dance-class-fees", "dance-class-missed-classes-and-holiday-policy"],
  blocks: [
    p("Pricing has two sides: what the market will pay, and what your studio needs to stay open. Most owners only look at the first. Here are both, with the numbers we could find."),
    h2("What studios charge"),
    p("A January 2026 guide from Superprof gives these monthly ranges for group classes across India:"),
    ul(
      "Bollywood: ₹1,000 to ₹2,500",
      "Hip-hop and urban: ₹1,200 to ₹3,000",
      "Classical (Bharatanatyam, Kathak, Odissi): ₹1,000 to ₹2,000 for beginners, more for advanced training",
      "Contemporary and jazz: ₹1,500 to ₹3,000",
    ),
    p("Those are national figures, and Superprof runs a tutor marketplace. For a city check, one BTM Layout studio in Bengaluru lists adult classes at ₹1,800 to ₹3,000 a month. Use both as a band to sanity-check against, not a price to copy. The best data is the fee at three studios near you, asked as a prospective dancer."),
    h2("Your floor price"),
    p("Add every cost that repeats each month, including the pay you want for yourself. Divide by the number of dancers you can realistically keep, not the number the room holds."),
    p("Example: costs of ₹90,000, owner pay of ₹40,000, and 55 dancers you can realistically keep. Floor: ₹1,30,000 ÷ 55 = ₹2,364. Round to ₹2,400. Below that, the studio pays you less than you planned, every month."),
    p("If your floor is above the market band, charging less rarely fixes it. Filling empty batch slots, cutting a cost, or adding a workshop or private classes usually does."),
    h2("What the fee means per class"),
    p("Dancers compare per class without saying so. ₹2,400 for 8 classes is ₹300 a class. ₹2,400 for 12 classes is ₹200. Write the number of classes on your fee sheet, so the comparison works in your favour."),
    p("Price drop-ins above the per-class rate of the monthly fee, for example ₹450 against ₹300. That makes the monthly plan the obvious choice, which is better for your cash flow and for the dancer's progress."),
    h2("Quarterly plans"),
    p("A small discount for paying three months ahead brings cash in early and cuts the number of reminders you send. 5% off ₹7,200 is ₹360, and you collect ₹6,840 on day one instead of chasing three payments. Keep the discount small. A large one becomes the real price."),
    h2("The ₹2,000 line"),
    p("If your studio's merchant UPI account receives more than ₹1 lakh a month, payments above ₹2,000 now cost you 0.4%. That is ₹10 on a ₹2,500 fee: too small to set your price around, and you may not add it to the dancer's bill. Count it in your costs. Our UPI post has the details."),
    h2("Raising your fee"),
    p("Give one month's notice, say the new amount and the date, and give a reason if you have one. Send it privately to each dancer, not in the group."),
    msg("Fee change, one month ahead", "Hi [name], a quick note from [studio]. From 1 [month], the monthly fee for [batch] will be ₹[new amount] (it is ₹[old amount] now). [Reason, for example: our rent went up this year.] Nothing else changes. Thank you for dancing with us, and message me if you have any questions."),
    note("ChoreoStudio shows who has paid, who is due and who is overdue each month, and opens a WhatsApp reminder with each dancer's own amount that you send yourself. First month free, no card needed."),
  ],
  faq: [
    {
      q: "How much do dance classes cost per month in India?",
      a: "A January 2026 Superprof guide puts group classes at roughly ₹1,000 to ₹3,000 a month depending on style. One Bengaluru studio lists adult classes at ₹1,800 to ₹3,000. Check three studios near you for local prices.",
    },
    {
      q: "How do I calculate the right fee for my dance studio?",
      a: "Add your monthly costs and the pay you want, then divide by the number of dancers you can realistically keep. With ₹1,30,000 and 55 dancers, the floor is about ₹2,400.",
    },
  ],
  sources: [SRC.superprof, SRC.ramis, SRC.upi],
};

/* ------------------------------------------------------------------ */

const gstClasses: Post = {
  slug: "gst-on-dance-classes-in-india",
  title: "GST on dance classes in India",
  metaTitle: "GST on Dance Classes in India: Threshold and Rules",
  description:
    "When a dance studio has to register for GST, what counts towards the ₹20 lakh limit, why the education exemption usually does not apply, and what to track.",
  date: DATE,
  readingMinutes: 6,
  related: ["how-to-run-a-dance-studio-in-india", "upi-charges-on-dance-class-fees", "how-to-plan-a-dance-showcase"],
  blocks: [
    p("This is a summary of the rules as we read them, written for studio owners. It is not tax advice. Before you register, charge GST or decide not to, check with a chartered accountant."),
    h2("When registration becomes compulsory"),
    p("Under section 22 of the CGST Act, a business must register once its aggregate turnover in a financial year exceeds ₹20 lakh. In special category states the limit is ₹10 lakh. Karnataka, Maharashtra, Delhi and Tamil Nadu are not special category states, so studios there use ₹20 lakh."),
    p("Aggregate turnover is counted across your PAN, from April to March. It includes everything the business earns from its services: monthly fees, admission fees, workshops, private classes, showcase tickets and costume charges. How you are paid makes no difference. Cash counts the same as UPI."),
    h2("A worked example"),
    p("60 dancers × ₹2,500 × 12 months = ₹18 lakh. Add 2 workshops at ₹1,000 for 40 dancers each (₹80,000) and a showcase bringing in ₹1,50,000 from tickets and costumes. The year comes to ₹20.3 lakh, just over the limit."),
    p("That is why a studio this size should keep a running total from April. Once you cross ₹20 lakh, you have 30 days to apply for registration."),
    h2("Why the education exemption usually does not apply"),
    p("Entry 66 of Notification 12/2017 exempts services provided by an 'educational institution'. The definition is narrow: it covers schools, and courses that lead to a qualification recognised by law. Advance rulings have said coaching providers fall outside it, for example the Andhra Pradesh ruling on Master Minds and a Gujarat ruling in 2026."),
    p("Those rulings are about exam coaching, and we found no ruling specifically on dance classes. A private dance studio is in a similar position, since it does not award a qualification recognised by law. Most advisers therefore treat studio fees as taxable once you are registered, at 18%. Confirm the rate and the classification with your CA."),
    h2("What changes after you register"),
    ul(
      "Your fee either includes GST or has it added. Decide which before you tell dancers. ₹2,500 including GST means ₹2,119 is yours and ₹381 is tax.",
      "You issue tax invoices and file returns, usually through your CA.",
      "You can usually claim credit for GST you pay on business costs, such as rent where the landlord charges GST.",
    ),
    h2("What to do now"),
    ol(
      "Keep a running total of everything the studio earns from 1 April, including showcases and workshops.",
      "When you reach about ₹15 lakh, talk to a CA so the switch is planned, not rushed.",
      "If you register, tell each dancer their new fee one month ahead, in a private message.",
    ),
    note("ChoreoStudio shows what you billed and collected each month, which makes the yearly total easy to keep. First month free, no card needed."),
  ],
  faq: [
    {
      q: "Do dance classes need GST registration?",
      a: "Only once the business's aggregate turnover in a financial year exceeds ₹20 lakh, or ₹10 lakh in special category states. Check with a chartered accountant before you decide.",
    },
    {
      q: "Are dance classes exempt from GST as education?",
      a: "Usually not. The exemption in Entry 66 of Notification 12/2017 applies to 'educational institutions' as defined, and advance rulings have held that coaching providers fall outside it.",
    },
    {
      q: "What counts towards the ₹20 lakh GST limit for a dance studio?",
      a: "Everything the business earns from its services in the financial year: fees, admission, workshops, private classes, showcase tickets and costume charges, however they are paid.",
    },
  ],
  sources: [SRC.sec22, SRC.entry66, SRC.masterminds],
};

/* ------------------------------------------------------------------ */

const adultsQuit: Post = {
  slug: "why-adult-dancers-quit-dance-classes",
  title: "Why adult dancers quit, and the first 12 weeks",
  metaTitle: "Why Adult Dancers Quit Dance Classes (and When)",
  description:
    "Research on group exercise puts dropout near half within six months, mostly in the first 12 weeks. A week-by-week plan and messages for keeping new adult dancers.",
  date: DATE,
  readingMinutes: 6,
  related: ["how-to-get-your-first-dancers", "dance-class-missed-classes-and-holiday-policy", "how-to-run-a-dance-studio-in-india"],
  blocks: [
    p("We found no study of adult dancers in India. The closest research is on group exercise programmes, and papers there keep reporting the same pattern: up to about half of new members drop out within three to six months, most of them in the first 12 weeks. One paper on older adults found much lower dropout in its own group, so the size varies. The timing is the useful part."),
    p("If most leaving happens early, the first 12 weeks are where your effort pays. A dancer still coming in month four is much less likely to leave."),
    h2("Why adults stop"),
    p("Adults rarely quit because the class was bad. More often a busy week turns into two missed weeks, and coming back feels awkward because the batch has learned a routine they missed. Some feel they are the slowest in the room. Some never made a friend in the batch. None of these arrive as a complaint. They arrive as an empty spot."),
    h2("A plan for the first 12 weeks"),
    h3("Week 1: a welcome"),
    msg("After the first class", "Hi [name], it was lovely having you in [batch] today. The first few classes are the hardest, so don't worry if the routine felt fast. See you on [day]!"),
    h3("Weeks 1 to 3: a name and a buddy"),
    p("Learn their name by the second class and use it. Pair them with a regular for partner work. A dancer who knows one other person in the batch has a reason to come back that has nothing to do with you."),
    h3("After two missed classes: ask, don't chase"),
    msg("Two classes missed", "Hi [name], we missed you in [batch] this week. All okay? If the timing isn't working, [other batch] on [day] covers the same routine."),
    p("Send this after two misses, not three. By the third, the habit has usually broken."),
    h3("Week 6: show progress"),
    p("With everyone's agreement, record the batch doing the routine at week 6 and share it in the group. Most adults can't see their own progress. A video shows it."),
    h3("Week 12: ask one question"),
    msg("Three months in", "Hi [name], you've been with us three months now! One quick question: is there anything that would make class better for you? Even a small thing helps."),
    h2("Watch the register, not the fee list"),
    p("A dancer who stops coming usually stops paying a few weeks later, so attendance is the earlier warning. Each week, look for anyone in their first 12 weeks who missed the last two classes, and message them that day."),
    note("ChoreoStudio keeps attendance for each batch and shows each dancer's attendance as a percentage, so a new dancer who is slipping is easy to spot. First month free, no card needed."),
  ],
  faq: [
    {
      q: "How many people drop out of dance or exercise classes?",
      a: "Research on group exercise programmes reports dropout of up to about 50% within three to six months, mostly in the first 12 weeks. We found no study specific to adult dance classes in India.",
    },
    {
      q: "When should I message a dancer who stopped coming?",
      a: "After two missed classes in a row. Ask whether everything is okay and offer another batch, rather than mentioning fees.",
    },
  ],
  sources: [SRC.dropoutCdc, SRC.dropoutOlder],
};

/* ------------------------------------------------------------------ */

const firstDancers: Post = {
  slug: "how-to-get-your-first-dancers",
  title: "How to get your first 30 dancers",
  metaTitle: "How to Get Your First 30 Dancers for a New Studio",
  description:
    "Work backwards from 30 dancers to the enquiries you need, then fill the top: a Google Business Profile, Instagram that shows the class, and a fast, fixed trial.",
  date: DATE,
  readingMinutes: 6,
  related: ["why-adult-dancers-quit-dance-classes", "how-to-price-dance-classes-in-india", "how-to-run-a-dance-studio-in-india"],
  blocks: [
    h2("Work backwards from 30"),
    p("Start with how many enquiries 30 dancers takes. The rates below are guesses to show the method. Replace them with yours after your first month."),
    ul(
      "If 1 in 2 trial dancers join, 30 dancers needs 60 trials",
      "If 1 in 3 enquiries books a trial, 60 trials needs 180 enquiries",
      "Over three months, that is about 15 enquiries a week",
    ),
    p("Two things move these numbers more than anything else: how fast you reply, and whether the trial is easy to say yes to. Both are free."),
    h2("Be findable: a Google Business Profile"),
    p("When someone searches 'dance classes near me', the map results come from Google Business Profiles. Creating one is free, and Google's help pages walk through it. Fill in the styles you teach, your batch times, photos of a real class and your WhatsApp number. Once your first dancers have been coming for a month, ask them for a review."),
    h2("Instagram: show the class, not the poster"),
    p("A 15-second clip of a real batch doing the routine tells a stranger more than a designed poster does: the level, the mood, the people. Post the end of each routine as a short reel, with the batch name, day and time in the caption. Put your area's name in the caption too, because people search by neighbourhood."),
    h2("Reply within the hour"),
    p("Someone asking about classes is often asking two other studios at the same time, and the first useful reply usually wins. Keep a ready answer to the questions everyone asks."),
    msg("First reply to an enquiry", "Hi [name], thanks for asking! [Batch] runs [days] at [time], ₹[fee] a month for [n] classes. Beginners are welcome. Would you like to try a class this [day]? The first one is [free / ₹ amount, adjusted in your first month's fee]."),
    h2("Make the trial a yes"),
    p("Decide your trial rule once and say it the same way every time: free, or paid and adjusted against the first month. Book a specific class on a specific day in the first reply. 'Come any time' turns into never."),
    p("After the trial, ask the same day, while the class is fresh."),
    msg("After the trial", "Hi [name], so glad you came today! If you'd like to join [batch], the fee is ₹[fee] for [month], and your spot is held till [date]. Any questions, just ask."),
    h2("Write every enquiry down"),
    p("Name, date, where they found you, and what happened. After a month you have your real rates and know which channel works. Without the list, you are guessing."),
    note("ChoreoStudio keeps your dancers, batches and fees in one place, so each new dancer is set up once. First month free, no card needed."),
  ],
  faq: [
    {
      q: "How do I get students for a new dance studio?",
      a: "Work out how many enquiries you need, then fill the top: a free Google Business Profile, short Instagram clips of real classes, a reply within the hour, and a fixed trial class rule.",
    },
  ],
  sources: [SRC.gbp],
};

/* ------------------------------------------------------------------ */

const payInstructors: Post = {
  slug: "how-to-pay-dance-instructors",
  title: "How to pay dance instructors: three models compared",
  metaTitle: "How to Pay Dance Instructors: Three Models Compared",
  description:
    "Per class, fixed monthly or a share of the batch fee, worked through for one batch, plus what to put in writing before an instructor starts.",
  date: DATE,
  readingMinutes: 6,
  related: ["how-to-run-a-dance-studio-in-india", "how-to-price-dance-classes-in-india", "gst-on-dance-classes-in-india"],
  blocks: [
    p("There are three common ways to pay an instructor, and each moves risk between you and them. Here they are worked through for the same batch, with example numbers you should replace with your own."),
    h2("The example batch"),
    p("15 dancers at ₹2,500 a month, 8 classes a month. The batch bills ₹37,500."),
    h2("1. Per class"),
    p("Example: ₹800 a class, so ₹6,400 a month, which is 17% of what the batch bills."),
    p("Simple, and the instructor is paid for exactly what they teach. But they earn the same whether the batch has 6 dancers or 20, so they have no reason to help it grow. You carry all the risk of a half-empty batch."),
    h2("2. Fixed monthly"),
    p("Example: ₹25,000 a month for teaching four batches, about ₹6,250 per batch."),
    p("Steady for the instructor and predictable for you. It suits someone who also helps run the studio. It can feel unfair in either direction when batches grow or shrink a lot, so review it every six months."),
    h2("3. A share of the batch fee"),
    p("Example: 30% of what the batch collects. With all 15 dancers paid, that is ₹11,250. If only 12 pay, it is ₹9,000."),
    p("The instructor shares the risk and the upside, so they care about filling and keeping the batch. Base it on what is collected, not billed, and agree that in writing. It also means showing them the batch's numbers each month, which needs a clean record."),
    h2("The same batch, three ways"),
    ul(
      "15 dancers, all paid (₹37,500): per class ₹6,400, fixed ₹6,250, 30% share ₹11,250",
      "8 dancers, all paid (₹20,000): per class ₹6,400, fixed ₹6,250, 30% share ₹6,000",
    ),
    p("Many studios combine them: a small amount per class plus a share above a set number of dancers. For example, ₹500 a class plus 20% of collected fees above 10 dancers."),
    h2("Put it in writing before day one"),
    ul(
      "How pay is worked out, and the date it is paid",
      "Who covers a class if they are ill, and how much notice they give",
      "The notice period if either side wants to stop",
      "Whether they may teach the same dancers privately or at a studio nearby",
      "Who owns choreography made for the studio's showcase",
    ),
    p("One page signed by both of you prevents most disputes. For tax questions, such as deducting TDS on payments to instructors, ask your CA."),
    note("ChoreoStudio tracks fees and attendance for each batch, which keeps the numbers you need for a fair conversation about pay in one place. First month free, no card needed."),
  ],
  faq: [
    {
      q: "How much should I pay a dance instructor?",
      a: "It depends on your fees and city. Work it out as a share of what the batch earns: ₹800 a class on a ₹37,500 batch is 17%. Many studios combine a per-class rate with a share of collected fees.",
    },
  ],
};

/* ------------------------------------------------------------------ */

const missedClasses: Post = {
  slug: "dance-class-missed-classes-and-holiday-policy",
  title: "Missed classes and holidays: a policy you can copy",
  metaTitle: "Dance Class Missed Classes and Holiday Policy Template",
  description:
    "A short fee policy for missed classes, studio holidays, pauses and late payment, ready to copy and adapt, plus the arithmetic for pro-rating a month.",
  date: DATE,
  readingMinutes: 5,
  related: ["how-to-price-dance-classes-in-india", "why-adult-dancers-quit-dance-classes", "how-to-run-a-dance-studio-in-india"],
  blocks: [
    p("Most fee arguments come from a rule nobody wrote down. Write it once, send it when a dancer joins, and point to it when a question comes up. Below is a policy you can copy and adapt."),
    h2("The policy"),
    msg(
      "Fee policy (copy and adapt)",
      "1. The monthly fee is ₹[amount] for [n] classes and is due by the [5th] of each month. 2. Missed classes are not refunded. You can make up to [2] missed classes a month in another batch of the same level, in the same month. 3. When the studio closes for a holiday, we tell you at least [2] weeks ahead. If we cancel more than [2] classes in a month, that month's fee is reduced for the cancelled classes. 4. You can pause for one full month, up to twice a year, if you tell us before the month starts. Your spot is held. 5. If the fee is not paid by the [15th], we will check in with you before the next month starts.",
    ),
    h2("Why each rule is there"),
    h3("Make-ups instead of refunds"),
    p("A refund for every missed class turns a monthly fee into a per-class fee, with all the counting that goes with it. A make-up in another batch keeps the dancer dancing at no cost to you, since that class is running anyway."),
    h3("Studio holidays"),
    p("Diwali week, exam season and your own breaks are fine. Tell dancers early and stick to your rule for when the fee drops. Pro-rate by classes: with 8 classes for ₹2,400, each is ₹300. If the studio cancels 3, that month's fee is ₹1,500."),
    h3("Pauses"),
    p("A dancer who travels for a month is more likely to come back if they paused than if they quit. Asking for notice before the month starts lets you offer the spot to someone waiting."),
    h3("Late payment"),
    p("A late fee looks firm on paper, but collecting it from adults you see twice a week is awkward, and many owners end up waiving it. A clear due date and a private reminder usually work better."),
    msg("Reminder after the due date", "Hi [name], a quick reminder that the [month] fee of ₹[amount] for [batch] was due on the [5th]. You can pay by [UPI ID / cash at the studio]. Thank you!"),
    h2("Send it when someone joins"),
    p("Send the policy with the first fee message, before any dispute. A rule someone read before joining is a rule they agreed to."),
    note("ChoreoStudio keeps due dates and what's still owed for each dancer, and opens a WhatsApp reminder with their own amount that you send yourself. First month free, no card needed."),
  ],
  faq: [
    {
      q: "Should a dance studio refund missed classes?",
      a: "Most monthly-fee studios do not refund missed classes but allow make-ups in another batch of the same level in the same month. Write the rule down and share it when a dancer joins.",
    },
    {
      q: "How do I pro-rate a dance class fee for studio holidays?",
      a: "Divide the monthly fee by the number of classes. With ₹2,400 for 8 classes, each class is ₹300, so cancelling 3 classes makes that month ₹1,500.",
    },
  ],
};

/* ------------------------------------------------------------------ */

const showcase: Post = {
  slug: "how-to-plan-a-dance-showcase",
  title: "How to plan a dance showcase without losing money",
  metaTitle: "How to Plan a Dance Showcase: Budget and Timeline",
  description:
    "A budget you can fill in, a 12-week timeline worked back from the show date, and how to keep showcase money separate from monthly fees.",
  date: DATE,
  readingMinutes: 6,
  related: ["gst-on-dance-classes-in-india", "how-to-pay-dance-instructors", "why-adult-dancers-quit-dance-classes"],
  blocks: [
    p("A showcase gives dancers a goal and gives the studio photos, videos and new enquiries. It can also cost far more than planned, because the costs arrive in pieces. Plan the money first."),
    h2("The budget"),
    p("The numbers below are an example for a 300-seat hall and 60 dancers. Get real quotes for yours."),
    ul(
      "Hall hire for the day, including rehearsal: ₹60,000",
      "Sound and lights: ₹25,000",
      "Photographer and videographer: ₹20,000",
      "Printing and stage decoration: ₹10,000",
      "Extra instructor hours for rehearsals: ₹15,000",
      "Buffer for things you forgot: ₹10,000",
    ),
    p("Total: ₹1,40,000. That is ₹2,333 for each of 60 dancers, before costumes."),
    h2("Who pays"),
    p("Most studios use one of these, or a mix:"),
    ul(
      "A participation fee per dancer, for example ₹1,500 × 60 = ₹90,000",
      "Audience tickets, for example 250 sold at ₹200 = ₹50,000",
      "Costumes charged at cost, collected separately",
    ),
    p("Here, ₹90,000 + ₹50,000 covers the ₹1,40,000. Decide the split before you announce the date, and say exactly what the participation fee includes."),
    h2("Keep showcase money separate"),
    p("Collect the participation fee as its own payment with its own due date, not added to the monthly fee. Mixed together, you lose track of who paid for what, and a part payment leaves you unsure which bill is still open. Ticket and showcase income also counts towards your yearly GST total."),
    h2("A 12-week timeline"),
    ol(
      "Week 12: book the hall, set the date and pay the deposit.",
      "Week 11: announce the date, the participation fee, what it includes and the payment deadline.",
      "Week 10: choreography starts in every batch.",
      "Week 8: participation fees due. Final list of who is performing.",
      "Week 6: costume sizes collected and ordered.",
      "Week 4: running order fixed. Tickets on sale.",
      "Week 2: full run-through. Photographer and sound confirmed.",
      "Week 1: technical rehearsal at the hall.",
      "After the show: share the video within a week, while dancers still feel it.",
    ),
    h2("After the show"),
    p("Showcases bring enquiries. Have your trial class reply ready, and post the best clips with your batch times in the caption."),
    note("ChoreoStudio shows who has paid and who still owes, so a showcase month doesn't bury the monthly fees. First month free, no card needed."),
  ],
  faq: [
    {
      q: "How much does a dance showcase cost?",
      a: "It depends on the hall and the city. Add up hall hire, sound and lights, photography, printing, extra instructor hours and a buffer. An example for a 300-seat hall comes to about ₹1,40,000 before costumes.",
    },
    {
      q: "How should a studio charge for a showcase?",
      a: "Usually a per-dancer participation fee plus audience tickets, with costumes charged at cost. Collect the showcase fee separately from monthly fees.",
    },
  ],
};

export const posts: Post[] = [
  runStudio,
  upiCharges,
  priceClasses,
  gstClasses,
  adultsQuit,
  firstDancers,
  payInstructors,
  missedClasses,
  showcase,
];

export const getPost = (slug: string) => posts.find((post) => post.slug === slug);

/** JSON-LD for one post: the article, its breadcrumbs and (when present) its FAQ. */
export function postSchema(post: Post) {
  const url = `${SITE}/blog/${post.slug}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Article",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.date,
      mainEntityOfPage: url,
      image: `${SITE}/og.png`,
      author: { "@type": "Organization", name: "ChoreoStudio", url: SITE },
      publisher: { "@type": "Organization", name: "ChoreoStudio", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/logo-mark.svg` } },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ChoreoStudio", item: SITE },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];
  if (post.faq?.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: post.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
