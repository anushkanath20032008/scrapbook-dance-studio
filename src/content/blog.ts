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

export const SITE = "https://choreostudio.live";

const trackFees: Post = {
  slug: "track-monthly-dance-class-fees",
  title: "How to track monthly dance class fees, step by step",
  metaTitle: "Track Dance Class Fees Each Month: A Routine | ChoreoStudio",
  description:
    "A month-by-month fee routine for dance studio owners: see who has paid, who is due, and copy reminder messages for dancers who are late.",
  date: "2026-10-24",
  readingMinutes: 7,
  related: ["reconcile-cash-upi-bank-dance-class-fees", "dance-class-fee-reminder-messages", "month-end-checklist-dance-studio-owner"],
  blocks: [
    {
      t: "p",
      text: "It is month end. Your notebook says Anand paid. A WhatsApp chat says Bela sent it last week. Your bank statement has a UPI credit with no name on it. You teach, you manage the studio, and now you are the accountant too.",
    },
    {
      t: "p",
      text: "This post gives you a routine you can start this month: what to do on which day, three messages to copy, and how to be sure a payment is real before you mark it paid. It is written for owner-run dance studios where dancers pay monthly by UPI, cash or bank transfer.",
    },
    { t: "h2", text: "Why monthly fees slip" },
    {
      t: "p",
      text: "Most late fees are not dancers refusing to pay. They are dancers who forgot, and an owner who was not sure who owed what. When the answer lives in three places (a notebook, a sheet and a chat), nobody checks until the month is almost over.",
    },
    {
      t: "p",
      text: "One software vendor's guide to running a dance studio in India makes the same point: the problem often starts with nobody tracking who owes what. Treat that as one vendor's view, not a study. It matches what many owners describe, so it is a good place to start fixing.",
    },
    { t: "h2", text: "A monthly fee routine you can copy" },
    {
      t: "p",
      text: "This is our own suggested routine, not a rule from a source. Change the days to fit how your studio works.",
    },
    { t: "h3", text: "Day 1: set the amounts" },
    {
      t: "p",
      text: "Write down, for each dancer, which batch they are in, the amount for the month and the due date. Decide your part-payment rule now. Some studios allow two instalments; one vendor guide for Karnataka dance schools lists instalments as a common option. If you allow it, write down the split so nobody has to guess later.",
    },
    { t: "h3", text: "Days 1 to 5: keep one list with three states" },
    {
      t: "p",
      text: "Every dancer is in exactly one of three states: paid, due, or overdue. Keep one list. Sort it so overdue is on top. If you cannot tell the state of a dancer in five seconds, the list is not working yet.",
    },
    { t: "h3", text: "Day 5: first reminder" },
    {
      t: "p",
      text: "Message everyone who is not marked paid. Keep it short, polite and specific: the month, the amount and how to pay. One school-fee guide suggests reminders a few days before the due date, on the due date, a couple of days after and about a week after. That guide is for schools and its own timings are not fully consistent, so use it as a starting point and adjust.",
    },
    { t: "h3", text: "Days 10 to 15: second reminder" },
    {
      t: "p",
      text: "For dancers still overdue, send a second message. Same calm tone, a clear date. If someone has a problem, this is where they will tell you.",
    },
    { t: "h3", text: "Month end: close the month" },
    {
      t: "ol",
      items: [
        "Count how many dancers are paid and how many are not.",
        "Add up what is still owed.",
        "For each name still open, write one decision: wait, call, part-payment, or pause the class.",
        "Check that the amount you recorded as received matches your bank or UPI statement and your cash notes.",
      ],
    },
    { t: "h2", text: "Three reminder messages to copy" },
    {
      t: "p",
      text: "Friendly, plain, firm. Change the names and amounts. Sample messages below use made-up names. We wrote all three for this post.",
    },
    {
      t: "msg",
      label: "Before the due date",
      text: "Hi Bela, a quick heads-up: your fee of ₹2,500 for this month is due on 5 Oct. You can pay by UPI to [your UPI ID]. Thank you!",
    },
    {
      t: "msg",
      label: "A few days after",
      text: "Hi Bela, a reminder from your studio: your fee of ₹2,500 was due on 5 Oct and is still open. If anything is off, just reply and we will sort it out. Thank you!",
    },
    {
      t: "msg",
      label: "A week or more overdue",
      text: "Hi Bela, your fee of ₹2,500 from 5 Oct is still open. Could you pay it by [date]? If that is difficult, reply and we can work out a plan. Thank you!",
    },
    { t: "h3", text: "Tips that keep the tone right" },
    {
      t: "ul",
      items: [
        "Use the dancer's first name.",
        "State the amount and the date. Vague messages get vague replies.",
        "Ask for one action, such as paying by a date or replying.",
        "Do not remind someone who has already paid.",
        "Thank them at the end.",
      ],
    },
    { t: "h2", text: "When a dancer says \"I've paid\"" },
    {
      t: "p",
      text: "Treat it as a claim until you have seen it in your own bank or UPI statement. Match the amount and the date, then mark it paid. For cash, write it down the same day with the date and the amount. If a dancer pays part of the fee, record what came in and what is left. Do not mark the month paid until the full amount is in.",
    },
    { t: "h2", text: "What to do about months that stay unpaid" },
    {
      t: "p",
      text: "Decide your rule once, write it down and keep to it. As one example, a 2014 Dance Teacher column from a studio in Ontario describes charging a fee after 30 days overdue and possibly removing a dancer from class after 60 days. The owner also noted that making exceptions sends mixed messages to dancers who always pay on time. That studio taught young dancers in another country, so use it only as an example of having a clear rule. This is not legal advice. Check your own rules with someone you trust.",
    },
    { t: "h2", text: "A notebook, a sheet, or ChoreoStudio" },
    {
      t: "p",
      text: "All three can work. A notebook is free and fine for a handful of dancers. A spreadsheet adds sorting and totals, but you still have to keep it and the chat in step. ChoreoStudio keeps one list: it shows who has paid, who is due and who is overdue. For each dancer who has not paid, it opens your own WhatsApp with that dancer's amount filled in, and you press Send. When a dancer says they have paid, you check your bank and confirm it. ChoreoStudio never holds your dancers' money.",
    },
    { t: "h2", text: "A month-end checklist" },
    {
      t: "ol",
      items: [
        "Amounts and due dates set for every dancer.",
        "One list, three states: paid, due, overdue.",
        "First reminder sent on day 5.",
        "Second reminder sent for anyone still overdue.",
        "Every \"I've paid\" checked against your statement.",
        "Cash written down the same day.",
        "Part payments recorded as part payments.",
        "One decision written next to every name still open.",
      ],
    },
    {
      t: "note",
      text: "ChoreoStudio is free for your first month, no card needed. Start free trial: choreostudio.live/login?mode=register",
    },
  ],
  faq: [
    {
      q: "How do I track monthly fees for a dance class?",
      a: "Keep one list where every dancer is paid, due or overdue. Set the amount and due date on day 1, send a reminder around day 5, send a second to anyone still overdue, and close the month by matching what you recorded to your bank or UPI statement.",
    },
    {
      q: "What should I say in a fee reminder to dancers?",
      a: "Use the first name, state the month and amount, ask for one action and thank them. A friendly heads-up before the due date, a plain reminder a few days after, and a firmer message with a date after a week or more.",
    },
    {
      q: "Should I trust a dancer who says they have paid?",
      a: "Treat it as a claim until you see the amount in your own bank or UPI statement, then mark it paid. Write cash down the same day.",
    },
  ],
  sources: [
    {
      label: "StudioPartner: how to run a dance studio in India",
      url: "https://studiopartner.app/blog/how-to-run-a-dance-studio-in-india",
      note: "A software vendor's blog, 12 June 2026. Used for the point that tracking who owes what is where problems start.",
    },
    {
      label: "CoFee: smart fee collection tips for dance schools in Karnataka",
      url: "https://www.cofee.life/blog/smart-fee-collection-tips-for-dance-schools-in-karnataka/",
      note: "A software vendor's blog, 20 November 2025. Used for instalments as a common option.",
    },
    {
      label: "FastFee: school fee reminder WhatsApp format",
      url: "https://fastfee.in/blog/school-fee-reminder-whatsapp-format",
      note: "A software vendor's blog about schools, 13 June 2026. Used for reminder timing as a starting point.",
    },
    {
      label: "Dance Teacher: dealing with overdue payments",
      url: "https://dance-teacher.com/ask-the-experts-dealing-with-overdue-payments/",
      note: "A magazine column by Joanne Chapman, 1 March 2014, about a studio in Ontario, Canada.",
    },
  ],
};

const cashUpiBank: Post = {
  slug: "reconcile-cash-upi-bank-dance-class-fees",
  title: "Cash, UPI and bank transfer: matching dance class fees at month end",
  metaTitle: "Match Cash, UPI and Bank Fees at Month End | ChoreoStudio",
  description:
    "Dancers pay by cash, UPI and bank transfer in the same month. Here is a simple way for a dance studio owner to match all three to what each dancer owes.",
  date: "2026-10-24",
  readingMinutes: 5,
  related: ["track-monthly-dance-class-fees", "month-end-checklist-dance-studio-owner", "dance-class-fee-reminder-messages"],
  blocks: [
    {
      t: "p",
      text: "In one month, a dance studio can be paid in cash at the door, by UPI to your phone and by bank transfer to your account. Each one leaves a trace in a different place. If you also keep a notebook and a chat, that is five places to check before you can say who has paid.",
    },
    {
      t: "p",
      text: "This is a short method for matching all of it at month end. It needs a pen and your statements. No tool is required, though a tool can keep the list for you.",
    },
    { t: "h2", text: "Start from what each dancer owes, not from what came in" },
    {
      t: "p",
      text: "The common mistake is to go through the bank statement and try to guess whose payment each line is. Turn it around. Start with the list of dancers and the amount each one owes this month. Then find the payment for each name. Anything left over on the statement is a mystery to solve second, not first.",
    },
    { t: "h2", text: "The method" },
    {
      t: "ol",
      items: [
        "List every dancer with the amount owed for the month.",
        "Go through your cash notes. Tick off each dancer who paid cash, with the date and the amount.",
        "Go through your UPI app. For each credit, match the sender and amount to a dancer. Write down the transaction reference.",
        "Go through the bank statement the same way for transfers.",
        "Put each payment against its dancer. If the amount is lower than owed, record it as a part payment and write what is left.",
        "If the amount is higher than owed, decide whether it is advance for next month or a mistake, and write that down.",
        "Anything on a statement you cannot match, ask the dancer by name. Do not guess.",
      ],
    },
    { t: "h2", text: "Four things that go wrong" },
    { t: "h3", text: "One payment covers two dancers" },
    {
      t: "p",
      text: "Friends and couples often pay together in one transfer. Record it as two payments against two names, and note that they came as one transfer.",
    },
    { t: "h3", text: "The UPI name is not the dancer's name" },
    {
      t: "p",
      text: "Someone pays from a friend's phone or a shared account. Ask the dancer to message you the amount and the date, then match on those. The reference number is the safest key.",
    },
    { t: "h3", text: "Cash that nobody wrote down" },
    {
      t: "p",
      text: "Write cash down the same day, with the date and the amount. A month later nobody remembers.",
    },
    { t: "h3", text: "A dancer says paid, nothing arrived" },
    {
      t: "p",
      text: "Ask for the reference number or a screenshot, then check your own statement. If it is not there, it is not paid yet. Say so kindly and give them the reference to check on their side.",
    },
    { t: "h2", text: "How ChoreoStudio helps with this" },
    {
      t: "p",
      text: "In ChoreoStudio you record each payment against a dancer with its method (cash, UPI, bank transfer or other) and an optional reference number. The app shows what is still owed after each payment. If you type an amount higher than what is owed, it asks before it records the extra as credit. When a dancer reports that they have paid, you check your bank or UPI statement and confirm it. ChoreoStudio only keeps the record. It never holds your dancers' money.",
    },
    {
      t: "note",
      text: "First month free, no card needed. Start free trial: choreostudio.live/login?mode=register",
    },
  ],
  faq: [
    {
      q: "How do I reconcile cash, UPI and bank payments for my dance classes?",
      a: "Start from the list of dancers and what each owes. Match cash notes, then UPI credits, then bank transfers to each name using the amount, date and reference number. Record part payments as part payments. Ask about anything you cannot match.",
    },
    {
      q: "What is the safest way to match a UPI payment to a dancer?",
      a: "Use the transaction reference number plus the amount and date. The sender name on UPI is not always the dancer's.",
    },
  ],
};

const reminderMessages: Post = {
  slug: "dance-class-fee-reminder-messages",
  title: "Dance class fee reminder messages you can copy and paste",
  metaTitle: "Dance Class Fee Reminder Messages to Copy | ChoreoStudio",
  description:
    "Eight copy-and-paste WhatsApp messages for dance studio owners: before the due date, overdue, part payments, cash received and when a dancer says they have paid.",
  date: "2026-10-24",
  readingMinutes: 4,
  related: ["dance-class-late-payment-policy", "dance-studio-whatsapp-group-tips", "track-monthly-dance-class-fees"],
  blocks: [
    {
      t: "p",
      text: "Asking for money is the part of running a studio nobody enjoys. These messages are short, polite and specific. Copy one, change the name and the amount, and send it from your own WhatsApp. We wrote all of them for this page. The names and amounts are made up.",
    },
    { t: "h2", text: "Before the due date" },
    {
      t: "msg",
      label: "Heads-up",
      text: "Hi Anand, a quick heads-up: your fee of ₹1,800 for Hip-hop this month is due on 5 Oct. You can pay by UPI to [your UPI ID]. Thank you!",
    },
    { t: "h2", text: "After the due date" },
    {
      t: "msg",
      label: "Gentle reminder",
      text: "Hi Bela, a reminder from your studio: your fee of ₹2,500 was due on 5 Oct and is still open. If anything is off, just reply and we will sort it out. Thank you!",
    },
    {
      t: "msg",
      label: "Second reminder with a date",
      text: "Hi Naina, your fee of ₹1,600 from 5 Oct is still open. Could you pay it by 20 Oct? If that is difficult, reply and we can work out a plan. Thank you!",
    },
    { t: "h2", text: "When the amount is not exact" },
    {
      t: "msg",
      label: "Part payment received",
      text: "Hi Chirag, thank you for the ₹1,000. Your fee for this month is ₹2,100, so ₹1,100 is still open. Could you pay the rest by 15 Oct?",
    },
    {
      t: "msg",
      label: "Paid more than owed",
      text: "Hi Bela, you sent ₹3,000 but this month's fee is ₹2,500. Would you like the extra ₹500 kept as credit for next month, or sent back?",
    },
    { t: "h2", text: "When money has come in" },
    {
      t: "msg",
      label: "Payment confirmed",
      text: "Hi Anand, we have received your ₹1,800 for this month. Thank you!",
    },
    {
      t: "msg",
      label: "Cash received",
      text: "Hi Naina, thank you for the ₹1,600 in cash today. We have noted it for this month.",
    },
    {
      t: "msg",
      label: "Dancer says paid but nothing shows yet",
      text: "Hi Chirag, thank you for letting us know. We cannot see the ₹2,100 in our account yet. Could you send the UPI reference number so we can match it? Thank you!",
    },
    { t: "h2", text: "Tips that keep the tone right" },
    {
      t: "ul",
      items: [
        "Use the dancer's first name.",
        "State the amount and the date.",
        "Ask for one action.",
        "Offer to talk if something is wrong.",
        "Do not send a reminder to someone who has already paid.",
        "Send from your own number so it reads like it is from you.",
      ],
    },
    { t: "h2", text: "Sending them faster" },
    {
      t: "p",
      text: "If you would rather not retype amounts, ChoreoStudio opens your own WhatsApp with each unpaid dancer's amount already filled in. You review it and press Send. It does not send anything by itself.",
    },
    {
      t: "note",
      text: "First month free, no card needed. Start free trial: choreostudio.live/login?mode=register",
    },
  ],
  faq: [
    {
      q: "What should I write to remind a dancer about an unpaid fee?",
      a: "Use their first name, the month, the amount and the date it was due, ask for one action, offer to talk if something is wrong, and thank them.",
    },
  ],
};

const latePayment: Post = {
  slug: "dance-class-late-payment-policy",
  title: "What to do when a dancer pays late: write your rule once",
  metaTitle: "Late Fee Payments at a Dance Studio: Write the Rule | ChoreoStudio",
  description:
    "A short guide for dance studio owners on late fee payments: pick a due date, a grace period and one standard message, then apply it the same way every month.",
  date: "2026-10-27",
  readingMinutes: 5,
  related: ["dance-class-fee-reminder-messages", "track-monthly-dance-class-fees", "month-end-checklist-dance-studio-owner"],
  blocks: [
    {
      t: "p",
      text: "A late payment is rarely a crisis. What hurts is deciding what to do about it again every month, one dancer at a time, while you are tired and the dancer is a friend. A written rule takes that decision away. You decide once, tell everyone once, and then follow it.",
    },
    {
      t: "p",
      text: "This guide is a set of suggestions, not a standard. Studios differ. Pick the parts that fit yours.",
    },
    { t: "h2", text: "The four parts of a fee rule" },
    {
      t: "ol",
      items: [
        "A due date. One date each month, the same for everyone. Many studios use the 1st or the 5th.",
        "A grace period. A few days after the due date when no reminder goes out. It saves you the awkward message to someone who was going to pay tomorrow anyway.",
        "A reminder step. What you send, when, and from which number. Use the same wording for everyone.",
        "A next step. What happens if the fee is still open after the reminder: a call, a pause on joining new classes, or a conversation. Write down which one you will actually do.",
      ],
    },
    { t: "h2", text: "Decide before you need it" },
    {
      t: "p",
      text: "Write the rule when no one owes you anything. A rule written in the middle of a dispute reads as a punishment. A rule that was in the welcome message on day one reads as how the studio works.",
    },
    { t: "h2", text: "Late fees: be careful" },
    {
      t: "p",
      text: "Some studios add a late fee. If you do, put the amount in writing before the dancer joins, keep it small and apply it to everyone. Check the rules that apply to your business before you add one, because we cannot tell you what is allowed for yours. Many owners choose not to charge one and use the reminder and the next step instead.",
    },
    { t: "h2", text: "Where to put the rule" },
    {
      t: "ul",
      items: [
        "In the message you send when a dancer joins.",
        "Pinned in your studio's WhatsApp group, if you have one.",
        "On a printed note at the front desk or door.",
      ],
    },
    { t: "h2", text: "A short rule you can adapt" },
    {
      t: "msg",
      label: "Fee rule",
      text: "Studio fees are due on the 5th of each month. If your fee is still open on the 8th, we will send you one reminder. If it is still open a week after that, we will call to see if something is wrong. If you need more time, tell us before the due date and we will agree a date together.",
    },
    { t: "h2", text: "Handling the dancer who is always late" },
    {
      t: "p",
      text: "If the same person is late every month, the rule is not the problem. Talk to them once, privately. Often the date does not fit their pay cycle, and moving their due date a few days solves it. Write the new date down so it is not a one-off favour.",
    },
    { t: "h2", text: "How ChoreoStudio helps" },
    {
      t: "p",
      text: "ChoreoStudio lists who is due and who is overdue, with the number of days overdue. For each unpaid dancer it opens a WhatsApp reminder with the dancer's amount filled in, and you press Send. Nothing is sent automatically.",
    },
    {
      t: "note",
      text: "First month free, no card needed.",
    },
  ],
  faq: [
    {
      q: "How long should a grace period be for dance class fees?",
      a: "There is no standard. Many studios allow a few days after the due date before sending a reminder. Pick a number, write it down and use it for everyone.",
    },
    {
      q: "Should a dance studio charge a late fee?",
      a: "It is your choice. If you do, state the amount in writing before the dancer joins and apply it to everyone. Check the rules that apply to your business first. Many owners use a reminder and a conversation instead.",
    },
    {
      q: "What should I do when a dancer pays late every month?",
      a: "Talk to them once, privately. Often their due date does not match when they are paid, and agreeing a different date fixes it.",
    },
  ],
};

const monthEndChecklist: Post = {
  slug: "month-end-checklist-dance-studio-owner",
  title: "A month-end checklist for dance studio owners",
  metaTitle: "Month-End Checklist for Dance Studio Owners | ChoreoStudio",
  description:
    "A one-page month-end checklist for a dance studio: count what came in, match cash, UPI and bank, chase the late ones, close the month and set up the next.",
  date: "2026-10-27",
  readingMinutes: 4,
  related: ["reconcile-cash-upi-bank-dance-class-fees", "dance-class-late-payment-policy", "track-monthly-dance-class-fees"],
  blocks: [
    {
      t: "p",
      text: "This is a checklist you can print or copy into a notebook. It takes a studio owner through the last day or two of a month so that the next one starts clean. Tick as you go.",
    },
    { t: "h2", text: "1. Count what came in" },
    {
      t: "ul",
      items: [
        "List every dancer with the amount owed for the month.",
        "Add up what has been received, and write the total next to the total owed.",
        "Work out the share collected: received divided by owed.",
      ],
    },
    { t: "h2", text: "2. Match how it was paid" },
    {
      t: "ul",
      items: [
        "Cash: check the cash notes against the cash you are holding.",
        "UPI: match each credit to a dancer by amount, date and reference.",
        "Bank transfer: do the same with your statement.",
        "Write down anything you cannot match and ask that dancer by name.",
      ],
    },
    { t: "h2", text: "3. Deal with part payments and extra amounts" },
    {
      t: "ul",
      items: [
        "For each part payment, write what is still owed.",
        "For each extra amount, decide whether it is advance for next month or a mistake.",
      ],
    },
    { t: "h2", text: "4. Chase the late ones" },
    {
      t: "ul",
      items: [
        "Sort the open fees by how long they have been open.",
        "Send each one the same reminder you would send anyone. Copy the wording from your fee rule.",
        "Note the date you reminded each dancer, so you do not message the same person twice in a day.",
      ],
    },
    { t: "h2", text: "5. Close the month" },
    {
      t: "ul",
      items: [
        "Save a copy of the final list: collected, still owed, and who.",
        "Carry the open amounts forward so they show next month.",
      ],
    },
    { t: "h2", text: "6. Set up the next month" },
    {
      t: "ul",
      items: [
        "Check the dancer list: who joined, who left, who changed batch.",
        "Check that each dancer's fee amount is right for the new month.",
        "Send the heads-up message a few days before the due date.",
      ],
    },
    { t: "h2", text: "How ChoreoStudio helps" },
    {
      t: "p",
      text: "ChoreoStudio has a Month end page. It shows the share collected, how the money came in by method (cash, UPI, bank transfer, other), and the late dancers you can remind from there. You still check your own statements before you confirm a payment.",
    },
    {
      t: "note",
      text: "First month free, no card needed.",
    },
  ],
  faq: [
    {
      q: "What should a dance studio owner do at the end of every month?",
      a: "Count what came in against what was owed, match cash, UPI and bank payments to each dancer, deal with part and extra payments, remind the late ones, save the final list, and check the dancer list for the next month.",
    },
    {
      q: "How do I work out the share of fees collected?",
      a: "Divide the total received by the total owed for the month. For example, if ₹40,000 was owed and ₹34,000 came in, the share collected is 85 percent.",
    },
  ],
};

const whatsappGroup: Post = {
  slug: "dance-studio-whatsapp-group-tips",
  title: "How to run a dance studio WhatsApp group without it taking over",
  metaTitle: "Dance Studio WhatsApp Group: Tips and Rules | ChoreoStudio",
  description:
    "Practical tips for a dance studio WhatsApp group: who should be in it, what to post, what to keep out, and when to message dancers privately about fees.",
  date: "2026-10-27",
  readingMinutes: 4,
  related: ["dance-class-fee-reminder-messages", "dance-class-late-payment-policy", "track-monthly-dance-class-fees"],
  blocks: [
    {
      t: "p",
      text: "For most studios, WhatsApp is where the studio lives. Class timings, music, costume photos and fee questions all land in the same place. That is useful until the group is so noisy that dancers mute it and miss the one message that mattered.",
    },
    { t: "h2", text: "One group for each purpose" },
    {
      t: "p",
      text: "Keep a group for announcements where only you and your instructors can post. Keep a separate group for chat if your dancers want one. Fees do not belong in either.",
    },
    { t: "h2", text: "What to post in the announcements group" },
    {
      t: "ul",
      items: [
        "Class changes and cancellations.",
        "Event and show dates.",
        "A short reminder that fees are due soon, with no names.",
      ],
    },
    { t: "h2", text: "What to keep out" },
    {
      t: "ul",
      items: [
        "Who has and has not paid. Nobody should read their balance, or someone else's, in a group.",
        "Long discussions. Move them to the chat group or to a call.",
        "Forwarded messages that have nothing to do with the studio.",
      ],
    },
    { t: "h2", text: "Fees go in private messages" },
    {
      t: "p",
      text: "A group post saying \"some fees are still pending\" makes the dancers who paid feel accused and the dancers who did not feel exposed. Send each person their own amount and due date, one to one. It is more respectful and it gets more replies.",
    },
    {
      t: "msg",
      label: "Private reminder",
      text: "Hi Chirag, a quick note from the studio: your fee of ₹2,000 for this month is due on 5 Oct. You can pay by UPI to [your UPI ID]. Thank you!",
    },
    { t: "h2", text: "Set a few rules on day one" },
    {
      t: "ol",
      items: [
        "Tell new dancers what the group is for, in the message you send when they join.",
        "Say when you read messages, so nobody expects an answer at midnight.",
        "Pin the studio's timings and the fee rule at the top.",
      ],
    },
    { t: "h2", text: "How ChoreoStudio fits in" },
    {
      t: "p",
      text: "ChoreoStudio does not post in your groups. For each unpaid dancer it opens a private WhatsApp message with the dancer's own amount filled in, and you press Send. That keeps fee talk out of the group without you typing each message.",
    },
    {
      t: "note",
      text: "First month free, no card needed.",
    },
  ],
  faq: [
    {
      q: "Should fees be discussed in a dance studio WhatsApp group?",
      a: "No. Send each dancer their own amount and due date in a private message. Use the group for announcements that apply to everyone.",
    },
    {
      q: "How many WhatsApp groups does a dance studio need?",
      a: "Two is usually enough: one for announcements where only you and your instructors post, and one for chat if your dancers want it.",
    },
  ],
};

export const posts: Post[] = [trackFees, cashUpiBank, reminderMessages, latePayment, monthEndChecklist, whatsappGroup];

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
