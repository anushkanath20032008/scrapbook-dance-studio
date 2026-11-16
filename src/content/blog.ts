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

const runStudio: Post = {
  slug: "how-to-run-a-dance-studio-in-india",
  title: "How to run a dance studio in India",
  metaTitle: "How to Run a Dance Studio in India | ChoreoStudio",
  description:
    "Most dance studios in India are started by a dancer, not a business person. Here are the five things to get in order as you grow: dancers, fees, attendance, batches and enquiries.",
  date: "2026-10-31",
  readingMinutes: 8,
  related: ["how-to-price-dance-classes-in-india", "how-to-get-your-first-dancers", "how-to-pay-dance-instructors", "gst-on-dance-classes-in-india"],
  blocks: [
    {
      t: "p",
      text: "Most studio owners start because they love to dance and teach, and the studio grows from a few students into a few batches. For a while that works on memory and goodwill. Then a second instructor joins, a weekend batch fills up, payments start arriving through three different UPI apps, and the WhatsApp group becomes the place where everything happens at once.",
    },
    {
      t: "p",
      text: "Nothing is wrong with your teaching at that point. What is missing is the business side, which nobody taught you and which you never had time to build. This guide covers the five things worth getting in order, roughly in the order they start to hurt.",
    },
    { t: "h2", text: "A studio is a small business that sells a skill" },
    {
      t: "p",
      text: "What you sell is scheduled access to a space, a good teacher and a group of people who keep each other motivated. Your income is the number of paying dancers multiplied by the fee, and your costs are mostly fixed: rent, instructor pay, electricity, sound and your own time. Because the costs do not change much from month to month, the dancers who stay and pay on time are what decide whether the studio is comfortable or stressful.",
    },
    {
      t: "p",
      text: "That is why the five systems below are about keeping dancers and money straight. None of them needs special software to start. They need a decision about where the truth lives and the habit of using it.",
    },
    { t: "h2", text: "1. One list of every dancer" },
    {
      t: "p",
      text: "Start with a single list that holds, for each dancer, their name, phone number, batch, monthly fee, the month they joined and how they usually pay. One row per person, kept in one place. When the same dancer appears in a notebook, a spreadsheet and a chat group with slightly different spellings, you will eventually charge someone twice or forget someone entirely.",
    },
    {
      t: "p",
      text: "Dancers at most studios are adults, so you talk to the dancer directly. Keep their number on the list and keep the list private. It should not live only on your phone, because the day your phone breaks is the day you need it.",
    },
    { t: "h2", text: "2. Fees, with one due date and three states" },
    {
      t: "p",
      text: "Fees are the system that decides whether you can pay the rent. Give every dancer the same due date each month, or at least a due date you wrote down, and mark each dancer as paid, due or overdue. That is the whole model. It sounds too simple, but most fee confusion comes from having a fourth state in your head, which is something like 'I think they paid, but I am not sure'.",
    },
    {
      t: "p",
      text: "Record every payment against the person it belongs to, with the date and how it arrived: cash, UPI or bank transfer. If a dancer pays part of the fee, write down how much is still owed rather than rounding it away. And when someone says they have paid by UPI, check your bank or UPI statement before you mark it. A screenshot is easy to send and easy to get wrong, and the statement is the only thing you can trust.",
    },
    {
      t: "p",
      text: "Talk about money in private. A reminder about someone's fee does not belong in the class group, where everyone reads it. A short personal message with their own amount and due date is more polite and gets a faster answer.",
    },
    { t: "h2", text: "3. Attendance as an early warning" },
    {
      t: "p",
      text: "Attendance is more than a register. A dancer who stops coming usually stops paying a few weeks later, so the register tells you about next month's income before the money does. A simple rule helps: when someone misses three classes in a row, send them a friendly message. You are not chasing them, you are asking if everything is alright and if they need a different batch.",
    },
    {
      t: "p",
      text: "Many dancers leave quietly because life got busy and nobody asked. One message at the right moment keeps some of them. We cannot tell you the exact number, because it differs from studio to studio, but you will learn your own after a few months of noting who you contacted and who came back.",
    },
    { t: "h2", text: "4. Batches and capacity" },
    {
      t: "p",
      text: "Write each batch down with its day, time, level, instructor and a maximum size based on what your floor can comfortably hold. Then you can answer, without thinking, which batches are full and which have space. Full batches are where you consider a waiting list or a second slot. Half-empty batches are where you ask whether the time or the level is wrong.",
    },
    {
      t: "p",
      text: "Capacity is also where money is lost without anyone noticing. A batch that holds twenty dancers but has twelve is leaving the same rent and the same instructor cost spread across fewer fees.",
    },
    { t: "h2", text: "5. Enquiries and trial classes" },
    {
      t: "p",
      text: "Every enquiry that arrives through Instagram, a phone call, a WhatsApp message or a walk-in is a possible dancer. Most studios lose some of them simply because the message got buried. Keep a short list with the name, the date they asked, what they asked about and when you will follow up.",
    },
    {
      t: "p",
      text: "Decide your trial class rule once: free, paid or credited against the first month. Then say it the same way every time, so nobody has to negotiate it and you do not have to remember what you told whom.",
    },
    { t: "h2", text: "Five numbers to look at once a month" },
    {
      t: "ul",
      items: [
        "How many dancers were enrolled this month",
        "How much you billed",
        "How much you collected",
        "How much is still owed, and how late it is",
        "How many dancers left, and how many joined",
      ],
    },
    {
      t: "p",
      text: "These five numbers, compared with last month, tell you whether the studio is growing, standing still or leaking. You do not need a dashboard for this. You need ten minutes at the end of the month and the habit of writing the numbers down.",
    },
    { t: "h2", text: "Do you need software?" },
    {
      t: "p",
      text: "Not at first. A notebook and a spreadsheet are enough for a single batch and one person taking payments. They start to strain once you have three or more batches, an instructor who also collects money, or dancers paying across several UPI apps. At that point it is worth choosing a tool that does fees and attendance well, and ignoring the ones that try to do everything.",
    },
    {
      t: "note",
      text: "If you want to try one built for owner-run dance studios, ChoreoStudio tracks fees and attendance and opens a WhatsApp reminder with each dancer's own amount filled in, which you send yourself. The first month is free and no card is needed.",
    },
    { t: "h2", text: "Where to start" },
    {
      t: "p",
      text: "Do not try to set up all five this week. Start with fees, because they affect the rent. Then build the dancer list and attendance, then batches, then enquiries, and finally the monthly numbers. One system a month is plenty.",
    },
    {
      t: "p",
      text: "If you do only one thing today, take a sheet of paper or a spreadsheet and write every dancer's name with three columns: owed, paid and pending. That single page will show you more about your studio than you probably expect.",
    },
  ],
  faq: [
    {
      q: "What systems does a dance studio need?",
      a: "Five are worth having: one list of dancers, a fee record with a due date, attendance, a list of batches with their capacity, and a simple record of enquiries and trial classes. Add a monthly look at five numbers: enrolled, billed, collected, still owed, and dancers who left.",
    },
    {
      q: "How should a small dance studio collect fees?",
      a: "Pick one due date, tell every dancer their amount, record each payment against the dancer when it arrives, and check UPI claims against your bank statement. Send reminders privately, not in the class group.",
    },
    {
      q: "Do I need software to run a dance studio?",
      a: "Not for one batch. A notebook and a spreadsheet work until you have several batches, more than one person taking payments, or dancers paying through different channels.",
    },
  ],
};

const priceClasses: Post = {
  slug: "how-to-price-dance-classes-in-india",
  title: "How to price dance classes in India",
  metaTitle: "How to Price Dance Classes in India | ChoreoStudio",
  description:
    "Copying the studio down the road is how many owners end up under-charging. Work out your monthly costs, your realistic number of dancers and the fee that covers both.",
  date: "2026-10-31",
  readingMinutes: 7,
  related: ["how-to-run-a-dance-studio-in-india", "gst-on-dance-classes-in-india", "why-adult-dancers-quit-dance-classes"],
  blocks: [
    {
      t: "p",
      text: "Many owners set their fee by asking what the studio down the road charges, and then charging a little less to attract dancers. It feels safe, but the neighbour may have cheaper rent, an owner who teaches every batch, or a bigger room. Their number tells you what the market will tolerate, not what your studio needs to stay open.",
    },
    {
      t: "p",
      text: "A better way is to work out your own number in three steps and then compare it with the market. The figures below are made up to show the method. They are not a suggested price, because rent, city and class type change everything.",
    },
    { t: "h2", text: "Step 1: add up what the studio costs each month" },
    {
      t: "p",
      text: "Write down every cost that repeats: rent, instructor pay, electricity, cleaning, music and sound equipment upkeep, internet, any software, marketing, and a portion of the larger costs you pay yearly, such as flooring repairs or mirrors, divided by twelve. Then add the pay you want for yourself, because a studio that only covers its costs is not yet a livelihood.",
    },
    {
      t: "p",
      text: "Suppose the total comes to ₹60,000 a month, including a modest amount for you. That is the amount your fees need to cover.",
    },
    { t: "h2", text: "Step 2: be honest about how many dancers you will really have" },
    {
      t: "p",
      text: "Multiply the number of batches by the size each batch can hold, and you get the best case. Then be realistic. Batches are rarely full all month, dancers miss months, and new ones take time to arrive. A helpful habit is to use the number of dancers you had on an ordinary month, not the best one.",
    },
    {
      t: "p",
      text: "Say you have six batches that could hold 10 dancers each, so 60 at the very most, and on an ordinary month you have 40 paying.",
    },
    { t: "h2", text: "Step 3: divide, then test what happens when it goes wrong" },
    {
      t: "p",
      text: "Break-even is the monthly cost divided by the dancers you expect: ₹60,000 divided by 40 is ₹1,500 per dancer. Anything above that is the room you have left for slow months, repairs and growth.",
    },
    {
      t: "p",
      text: "Now test it. If you charge ₹2,000 and 40 dancers pay, you collect ₹80,000 and have ₹20,000 left over. If only 28 pay in a quiet month, you collect ₹56,000, which is below your ₹60,000 costs. The same fee that looked comfortable at 40 dancers loses money at 28. Looking at the bad month before you commit to a fee is the most useful part of this exercise.",
    },
    { t: "h2", text: "Ways to structure the fee" },
    {
      t: "ul",
      items: [
        "A fixed monthly fee for a set number of classes. It is the easiest to explain and gives you predictable income, but dancers who miss classes may feel they are paying for nothing.",
        "A pack of classes, such as eight or twelve, valid for a set time. It suits dancers with unpredictable schedules, but you need to track how many are left and when the pack expires.",
        "A drop-in price for a single class. Keep it higher than the per-class cost inside a pack, so the pack or monthly fee is clearly the better value.",
        "A discount for paying a quarter at once. It improves your cash flow, but only offer it if you are comfortable holding a few months of someone's fee in case they leave.",
      ],
    },
    { t: "h2", text: "Write the rules next to the price" },
    {
      t: "p",
      text: "A price on its own invites arguments. Write down, and tell every new dancer, what happens when someone misses a class, when the studio is closed for a holiday, when someone joins in the middle of the month, and when a payment is late. Settling these once saves you dozens of small awkward conversations. If you want to be generous, decide in advance how, for example one make-up class per month, so it is a rule and not a favour.",
    },
    { t: "h2", text: "When and how to raise your fees" },
    {
      t: "p",
      text: "Costs go up, so fees eventually have to as well. Give your dancers at least a month's notice, say plainly why, and apply the new fee to new dancers first. Dancers are generally more understanding of a clear, early message than of a surprise on the day the fee is due.",
    },
    {
      t: "note",
      text: "Whichever fee you choose, keep a record of what each dancer owes and what they have paid each month. A simple list with owed, paid and pending columns is enough to start.",
    },
  ],
  faq: [
    {
      q: "How do I decide what to charge for dance classes?",
      a: "Add up your monthly costs including your own pay, estimate how many dancers you will have in an ordinary month, and divide. That is your break-even fee per dancer. Then check it against what nearby studios charge and adjust.",
    },
    {
      q: "Is a monthly fee or a class pack better for a dance studio?",
      a: "A monthly fee is simpler and gives steadier income. A class pack suits dancers with irregular schedules but needs expiry and balance tracking. Many studios offer both, with the monthly fee as the better value.",
    },
    {
      q: "How much notice should I give before raising fees?",
      a: "At least a month. Explain the reason briefly and start with new dancers.",
    },
  ],
};

const gstClasses: Post = {
  slug: "gst-on-dance-classes-in-india",
  title: "GST on dance classes in India",
  metaTitle: "GST on Dance Classes in India | ChoreoStudio",
  description:
    "Dance classes run as a business are generally taxable at 18% GST, with registration needed once yearly turnover crosses a threshold. Here is how it works, with a worked example.",
  date: "2026-10-31",
  readingMinutes: 6,
  related: ["how-to-price-dance-classes-in-india", "how-to-run-a-dance-studio-in-india"],
  blocks: [
    {
      t: "note",
      text: "This is general information, not tax or legal advice. GST rules and thresholds change, so confirm the current position with a chartered accountant or on the official GST portal before you act.",
    },
    {
      t: "p",
      text: "GST is one of the questions studio owners ask last and worry about most. Many wonder whether dance classes are exempt because they are cultural or educational, and whether a small studio has to register at all. The short answer from the commentary we read is that dance classes run as a commercial service are generally taxable, and registration depends on how much the studio earns in a year.",
    },
    { t: "h2", text: "Are dance classes taxable?" },
    {
      t: "p",
      text: "The exemptions for education in GST law are aimed mainly at recognised schools and similar institutions. Tax professionals who have written about dance workshops and dance classes generally conclude that a studio teaching dance as a business does not fall under those exemptions, whether the style is classical, Western or fitness-based. The usual rate applied to coaching and training services of this kind is 18%.",
    },
    {
      t: "p",
      text: "Some of the writing on this is a few years old and comes from consultants rather than from a ruling about your specific studio. If your situation is unusual, for example you teach inside a school or a trust, ask your accountant which treatment applies.",
    },
    { t: "h2", text: "When does a studio have to register?" },
    {
      t: "p",
      text: "For services, registration is generally required once your total turnover in a financial year goes above ₹20 lakh, with a lower limit in some special category states. Turnover means all your taxable income, so it includes workshops, special events and any other classes you teach through the same registration, not only the monthly fees from regular batches.",
    },
    {
      t: "p",
      text: "A studio below the threshold does not have to register, but it can choose to. Some do so because corporate clients or other businesses want tax invoices, or because they want to claim credit for GST paid on their own purchases.",
    },
    { t: "h2", text: "A worked example: a fee that includes GST" },
    {
      t: "p",
      text: "Suppose you are registered and you advertise a fee of ₹2,000 that includes 18% GST. The tax is not added on top. It is already inside the ₹2,000, so you only keep part of it.",
    },
    {
      t: "ul",
      items: [
        "Fee the dancer pays: ₹2,000",
        "Value before tax: ₹2,000 divided by 1.18, which is about ₹1,695",
        "GST included: about ₹305, which you pay to the government",
      ],
    },
    {
      t: "p",
      text: "If you had planned your costs around keeping the full ₹2,000, registration would leave you about ₹305 per dancer short. This is why it matters to decide whether your published fee includes tax before you cross the threshold, and to factor it into your pricing.",
    },
    { t: "h2", text: "What registration involves day to day" },
    {
      t: "ul",
      items: [
        "Giving each dancer a proper invoice that shows the tax",
        "Keeping a clear record of every payment, whether cash, UPI or bank transfer",
        "Filing GST returns on time, usually monthly or quarterly depending on your choice and turnover",
        "Paying the tax you collected, less any credit you are entitled to",
      ],
    },
    {
      t: "p",
      text: "The record keeping is where studios struggle. If you cannot say how much you received in a month and who paid it, filing a return becomes guesswork. Whether or not you are registered yet, keep a clean record of payments from the start. It makes the day you cross the threshold much easier.",
    },
    { t: "h2", text: "Questions to take to your accountant" },
    {
      t: "ul",
      items: [
        "Does my studio's turnover, counted across all my classes and workshops, cross the threshold this year or the next?",
        "Should my published fee include or exclude GST once I am registered?",
        "Do the workshops I run, or the classes I teach inside other institutions, change the answer?",
        "Is voluntary registration worth it for us?",
      ],
    },
  ],
  sources: [
    {
      label: "CAclubindia: GST on dance classes and workshops",
      url: "https://www.caclubindia.com/articles/gst-on-dance-classes-workshops-50442.asp",
      note: "A tax professional's view that dance classes and workshops are not covered by the education exemptions.",
    },
    {
      label: "Taxclue: Is GST registration required for a dance academy?",
      url: "https://taxclue.in/blog/is-gst-registration-required-for-a-dance-academy",
      note: "A guide to registration for dance academies. Check its thresholds against current rules.",
    },
  ],
  faq: [
    {
      q: "Is GST applicable on dance classes?",
      a: "Tax professionals generally treat dance classes run as a business as taxable services, usually at 18%. Exemptions for education are aimed at recognised schools and similar institutions. Confirm with a chartered accountant for your case.",
    },
    {
      q: "Does a small dance studio need GST registration?",
      a: "Registration for services is generally needed once yearly turnover goes above ₹20 lakh, lower in some special category states. Below that you can still register voluntarily.",
    },
    {
      q: "Is the 18% GST added on top of my class fee?",
      a: "It depends on how you price. If your published fee is inclusive of GST, the tax is a part of it. At ₹2,000 inclusive of 18%, about ₹305 is GST.",
    },
  ],
};

const adultsQuit: Post = {
  slug: "why-adult-dancers-quit-dance-classes",
  title: "Why adult dancers quit classes",
  metaTitle: "Why Adult Dancers Quit Dance Classes | ChoreoStudio",
  description:
    "Adults rarely quit dance because they stopped liking it. They quit because of schedules, feeling lost in class, or nobody noticing they stopped coming. Here is what studios can do.",
  date: "2026-10-31",
  readingMinutes: 6,
  related: ["how-to-run-a-dance-studio-in-india", "how-to-price-dance-classes-in-india"],
  blocks: [
    {
      t: "p",
      text: "Anyone who has run a studio for a year has seen the pattern. A new dancer arrives full of energy, comes regularly for three or four weeks, then misses a class, then another, and one day you realise you have not seen them for a month. Nobody argued with anyone and nobody complained. They just drifted away.",
    },
    {
      t: "p",
      text: "This is a list of the reasons we think are most common, based on how owners describe it rather than on a study, and a few things that cost very little to try. Treat it as a set of ideas to test in your own studio.",
    },
    { t: "h2", text: "Why adults leave" },
    { t: "h3", text: "Their schedule changed" },
    {
      t: "p",
      text: "Work deadlines, travel, family events and exams move around, and a fixed weekly slot is the first thing to give way. When a dancer misses two classes because of work, the third one starts to feel like catching up on something they have already lost.",
    },
    { t: "h3", text: "They felt lost in the class" },
    {
      t: "p",
      text: "A beginner placed with people who already know the routine feels behind every week, and adults do not like feeling behind in public. Some of them never say so. They just stop coming.",
    },
    { t: "h3", text: "They stopped seeing progress" },
    {
      t: "p",
      text: "The first few weeks are exciting because everything is new. After that, improvement feels slow, and without a clear sign that they are getting better, motivation fades.",
    },
    { t: "h3", text: "Nobody knew them" },
    {
      t: "p",
      text: "A dancer who has made one friend in class has a reason to come back, even on a tired evening. A dancer who arrives, dances and leaves without speaking to anyone has no one to notice that they are gone.",
    },
    { t: "h3", text: "The money conversation was awkward" },
    {
      t: "p",
      text: "Being chased in a group message, or by more than one person, is unpleasant enough that some dancers would rather leave than deal with it. A single, private and polite reminder keeps the money question from turning into a reason to quit.",
    },
    { t: "h2", text: "What studios can do about it" },
    { t: "h3", text: "Make the first three classes easy" },
    {
      t: "p",
      text: "Introduce every new dancer to the group in the first class, pair them with someone friendly, and check in with them after the third class. The aim is that nobody spends their first weeks feeling invisible.",
    },
    { t: "h3", text: "Be clear about levels" },
    {
      t: "p",
      text: "Say plainly who each batch is for, and let people move up or down without embarrassment. A beginner who is happy in the right batch is worth more than a beginner who struggles in the wrong one.",
    },
    { t: "h3", text: "Give people a visible finish line" },
    {
      t: "p",
      text: "A short routine taught over a month, which the batch performs for each other at the end, gives dancers something to look forward to and something to be proud of. It does not need a stage or an audience.",
    },
    { t: "h3", text: "Notice absences early" },
    {
      t: "p",
      text: "When a dancer misses three classes in a row, send a message. Something like this works:",
    },
    {
      t: "msg",
      label: "After three missed classes",
      text: "Hi [name], we have missed you in class the last few weeks. Is everything alright? If your schedule has changed, tell me and we can look at a different batch. No pressure, just checking in.",
    },
    {
      t: "p",
      text: "The message asks about the dancer and not about the fee. Many people answer it, and some of them come back.",
    },
    { t: "h3", text: "Make pausing easier than quitting" },
    {
      t: "p",
      text: "Offer a way to pause for a month, for travel or a busy period, without losing their place. It is much easier to come back from a pause than to rejoin after quitting.",
    },
    { t: "h3", text: "Ask why they left" },
    {
      t: "p",
      text: "When someone does leave, send one short question: what could we have done better? You will not always get an answer, but the ones you do get tell you something no register or spreadsheet can.",
    },
    { t: "h2", text: "A small habit to start with" },
    {
      t: "p",
      text: "Keep a list of dancers you have not seen in three weeks and message each of them this week. It takes about ten minutes, and it costs nothing. Write down who replied and who came back, and in a month you will know how much it is worth to your studio.",
    },
    {
      t: "note",
      text: "If you track attendance and fees in one place, it is easier to spot who has stopped coming. ChoreoStudio keeps attendance and fees together for owner-run dance studios, and the first month is free with no card needed.",
    },
  ],
  faq: [
    {
      q: "Why do adults quit dance classes?",
      a: "Common reasons are schedule changes, feeling behind the rest of the class, not seeing progress, not knowing anyone, and awkward conversations about money. Most do not complain; they simply stop coming.",
    },
    {
      q: "How can a dance studio keep adult dancers coming?",
      a: "Make the first three classes welcoming, be clear about levels, give dancers a short routine to work towards, message anyone who misses three classes in a row, and offer a way to pause.",
    },
    {
      q: "What should I say to a dancer who has stopped coming?",
      a: "Ask how they are and offer a different batch if their schedule has changed. Do not mention fees in that first message.",
    },
  ],
};

const firstDancers: Post = {
  slug: "how-to-get-your-first-dancers",
  title: "How to get your first 30 dancers",
  metaTitle: "How to Get Your First 30 Dancers | ChoreoStudio",
  description:
    "A new dance studio in India does not need a big marketing budget. It needs a clear offer, a trial class, and a way to follow up with everyone who asks.",
  date: "2026-10-31",
  readingMinutes: 6,
  related: ["how-to-run-a-dance-studio-in-india", "how-to-price-dance-classes-in-india", "why-adult-dancers-quit-dance-classes"],
  blocks: [
    {
      t: "p",
      text: "The first thirty dancers are the hardest, and almost nobody gets them through advertising. They come from people who already trust you, people who saw you teach, and people who heard from a friend that your class is worth a try. The work in the early months is to make it easy for those people to find you and easy for them to say yes.",
    },
    { t: "h2", text: "Decide who the class is for" },
    {
      t: "p",
      text: "A studio that says it teaches everyone usually attracts no one in particular. Pick one group to start with, such as working adults who want a weekend class, or beginners who have never danced, or women who want a class close to home. Then describe the class in their words: the day, the time, the style, the level, and what a first class will feel like.",
    },
    {
      t: "p",
      text: "The more specific the description, the easier it is for the right person to think this is for me. A vague post gets a like and a quick scroll. A post that says Saturday 8 am, beginner Bollywood, no experience needed, gets a message from someone who is already thinking about it.",
    },
    { t: "h2", text: "Start with the people who already know you" },
    {
      t: "ul",
      items: [
        "Friends, relatives and colleagues who have seen you dance or teach. Ask them directly, and ask them to bring a friend.",
        "Your own social accounts. Post the class details with a short video of a real class, not only a poster.",
        "Housing societies, offices and community groups in your area, where a weekend class can fill quickly through a single message to the right group.",
        "Other local studios and instructors who teach a different style and may send you people who ask for yours.",
      ],
    },
    { t: "h2", text: "Make the first step small" },
    {
      t: "p",
      text: "Most people hesitate for the same reasons: they are not sure they will like it, they worry they will be the only beginner, and they do not want to commit money to something they have not tried. A trial class answers all three. Decide your rule once, whether it is free, a small fee or a fee that counts towards the first month, and say it the same way every time.",
    },
    {
      t: "p",
      text: "Give trial dancers a warm first class. Introduce them to the group, put them next to someone friendly, and message them the next day. The follow-up is where many studios win or lose the dancer.",
    },
    { t: "h2", text: "Answer enquiries quickly and keep a list" },
    {
      t: "p",
      text: "Someone who asks about a class on Instagram or WhatsApp is usually asking several studios at once. The one who replies first, with the day, time, fee and a clear next step, often gets the trial. Keep a simple list of every enquiry with the date, the person's name, what they asked about, and when you will follow up. A message that sits unread for three days has usually already lost the person.",
    },
    {
      t: "p",
      text: "When someone says they will think about it, ask if you can message them again on a specific date. Then do it. A short, friendly follow-up is not pushy, and many people simply needed a reminder.",
    },
    { t: "h2", text: "Ask for referrals at the right moment" },
    {
      t: "p",
      text: "A dancer who has just enjoyed a good class is the best person to ask, and the right time is right then. Invite them to bring a friend to the next class for free, or to share one short video from class with their own message. People trust a friend's recommendation far more than a studio's own post.",
    },
    { t: "h2", text: "A realistic first month" },
    {
      t: "ol",
      items: [
        "Week 1: write down who the class is for and describe it in one clear message with day, time, level and fee.",
        "Week 2: send it personally to thirty people who might know someone interested, and post it in two or three relevant local groups.",
        "Week 3: run trial classes, follow up with each person the next day, and note who said yes, who said maybe and why.",
        "Week 4: ask each new dancer to bring one friend, and adjust the time or description based on what people asked.",
      ],
    },
    {
      t: "p",
      text: "Do not worry if the numbers are small at first. Ten dancers who keep coming and tell their friends are worth more than thirty who arrive once. Keep notes on where each dancer came from, and in two or three months you will know which of these routes is actually working for your studio.",
    },
  ],
  faq: [
    {
      q: "How do I get students for a new dance studio?",
      a: "Start with people who already know you, describe one class clearly for one group, offer a trial class, reply to enquiries quickly and ask happy dancers to bring a friend.",
    },
    {
      q: "Should a trial dance class be free?",
      a: "Either works. Free lowers the barrier, a small fee filters for people who will come, and a fee credited to the first month does both. Choose one and say it the same way every time.",
    },
    {
      q: "How long does it take to build a full batch?",
      a: "It differs a lot by area and style, so there is no reliable number. Track where each dancer came from and you will see how long it takes in your own studio.",
    },
  ],
};

const payInstructors: Post = {
  slug: "how-to-pay-dance-instructors",
  title: "How to hire and pay dance instructors",
  metaTitle: "How to Hire and Pay Dance Instructors | ChoreoStudio",
  description:
    "Three common ways to pay a dance instructor, what each costs you, and what to agree in writing before the first class so there are no surprises later.",
  date: "2026-10-31",
  readingMinutes: 6,
  related: ["how-to-run-a-dance-studio-in-india", "how-to-price-dance-classes-in-india", "dance-class-missed-classes-and-holiday-policy"],
  blocks: [
    {
      t: "p",
      text: "At some point you cannot teach every batch yourself, and the first instructor you bring in changes how the studio works. Money is the part that most often goes wrong, usually because the two of you assumed different things and never wrote them down. This post covers the common ways to pay an instructor and what to settle before the first class.",
    },
    { t: "h2", text: "Three ways to pay" },
    { t: "h3", text: "A fixed amount per class" },
    {
      t: "p",
      text: "You pay the instructor a set amount for every class they teach, whether ten dancers show up or four. It is simple to understand and easy to budget, and it protects the instructor from a quiet week. The risk is yours: if a batch is small, you still pay the full amount.",
    },
    { t: "h3", text: "A fixed monthly amount" },
    {
      t: "p",
      text: "You agree a monthly amount for a set number of classes a week. It works for a regular instructor who teaches the same batches every week. Be clear about what happens when there are five weeks in a month, when the studio closes for a holiday, and when the instructor takes a day off.",
    },
    { t: "h3", text: "A share of the fees" },
    {
      t: "p",
      text: "The instructor receives a percentage of what their batch pays. It lines up your interests, because both of you gain when the batch fills. It needs a clear record of who paid, because the instructor will want to see how their share was worked out, and a rule for dancers who pay late or only part of the fee.",
    },
    {
      t: "p",
      text: "Some studios combine these, such as a small fixed amount per class plus a share above a certain number of dancers. Whichever you choose, work out what it costs you at a good month and at a quiet month before you agree, as in the pricing example in our guide to pricing classes.",
    },
    { t: "h2", text: "What to agree before the first class" },
    {
      t: "ul",
      items: [
        "Which batches they teach, on which days and at what times.",
        "How and when they are paid, and who records the classes taught.",
        "What happens when a class is cancelled, by you, by them or because of a holiday.",
        "Who finds a replacement when they are unwell, and how that is paid.",
        "Whether they may teach elsewhere, and whether they may take your dancers to a competitor's class or a private class.",
        "Who owns the choreography they create for your batches and showcase.",
        "How either of you ends the arrangement, and how much notice is fair.",
      ],
    },
    {
      t: "p",
      text: "Put it in a short written agreement that both of you sign, even if you are friends. A page is enough. The agreement is not a sign of distrust. It protects both of you from remembering the same conversation differently six months later. For anything involving tax or employment status, ask a chartered accountant or a lawyer, because the rules depend on how the arrangement is set up.",
    },
    { t: "h2", text: "How to choose an instructor" },
    {
      t: "p",
      text: "A great dancer is not always a great teacher. Before you hire, ask the person to teach a trial class to your own dancers and watch how they explain a step, how they treat beginners, how they handle a mixed-level room and whether they arrive on time. Ask a couple of their former students how it was to learn from them. The dancers who will be in the room are the best judges of whether it works.",
    },
    { t: "h2", text: "Keeping instructors informed without sharing everything" },
    {
      t: "p",
      text: "An instructor needs to know who is in their batch, who attended, and who has not been coming. They do not need to know how much each dancer pays or who is late with their fee. Decide what each instructor can see, and keep the money information with the owner.",
    },
    {
      t: "p",
      text: "Share the batch list and attendance with the instructor each week, and ask them to tell you when a dancer has stopped coming. They are often the first to notice.",
    },
  ],
  faq: [
    {
      q: "How much should I pay a dance instructor?",
      a: "There is no standard figure, because it depends on your city, the style and the instructor's experience. Work out what you can afford at a quiet month, then agree a per-class amount, a monthly amount or a share of fees.",
    },
    {
      q: "Should I pay instructors per class or monthly?",
      a: "Per class is simple and flexible. Monthly suits a regular instructor with fixed batches. A share of fees ties pay to how full the batch is. Agree what happens on holidays and cancelled classes whichever you choose.",
    },
    {
      q: "Do I need a written agreement with an instructor?",
      a: "It is a good idea. A one-page agreement covering pay, cancellations, replacements, choreography and notice prevents most disagreements. For tax or legal questions, ask a professional.",
    },
  ],
};

const missedClasses: Post = {
  slug: "dance-class-missed-classes-and-holiday-policy",
  title: "Missed classes and holidays: write the rules",
  metaTitle: "Dance Class Missed Class and Holiday Policy | ChoreoStudio",
  description:
    "Dancers miss classes, studios close for holidays, and someone always joins mid-month. Settle the rules once so you are not negotiating every time.",
  date: "2026-10-31",
  readingMinutes: 5,
  related: ["how-to-price-dance-classes-in-india", "how-to-pay-dance-instructors", "why-adult-dancers-quit-dance-classes"],
  blocks: [
    {
      t: "p",
      text: "Every studio owner has had the same conversation more than once. A dancer says they were travelling and asks if they can skip the fee this month, or if they can attend a different batch to make up for it. You say yes because it feels unkind to say no, and then the next dancer asks the same thing, and soon your rules are whatever you agreed last.",
    },
    {
      t: "p",
      text: "The fix is not to be stricter. It is to decide the rules once, write them down, and tell every new dancer before their first class. People accept a clear rule far more easily than a decision made on the spot.",
    },
    { t: "h2", text: "The situations to decide in advance" },
    { t: "h3", text: "A dancer misses a class" },
    {
      t: "p",
      text: "Most studios treat the monthly fee as paying for a place in the batch, not for each class, so a missed class is not refunded. Then you choose how generous to be. You might allow one make-up class a month in another batch at the same level, if there is room, and ask the dancer to tell you the day before.",
    },
    { t: "h3", text: "The studio closes for a holiday" },
    {
      t: "p",
      text: "Decide whether a closed week reduces the fee, is made up with an extra class later, or is already built into your yearly pricing. Tell dancers the holiday dates at the start of the month, not the week before.",
    },
    { t: "h3", text: "Someone joins in the middle of the month" },
    {
      t: "p",
      text: "You can charge the full month, charge for the remaining weeks, or start the fee from the next month and let the first weeks count as a trial. The part-month option takes a small calculation, so decide the rule and an easy way to work it out, such as charging by the number of weeks left.",
    },
    { t: "h3", text: "Someone needs a break" },
    {
      t: "p",
      text: "Offering a pause of up to a month, for travel, illness or a busy period, keeps people connected to the studio. Decide how much notice you need and whether their place in the batch is held. A dancer who can pause is more likely to return than one who has to quit.",
    },
    { t: "h3", text: "A payment is late" },
    {
      t: "p",
      text: "Pick a date after which you send a reminder, and a date after which the dancer cannot attend until the fee is settled, if you want a hard line. Many owners prefer a friendly reminder first and a firm rule only for repeated lateness. Whatever you choose, make it the same for everyone.",
    },
    { t: "h2", text: "A short policy you can adapt" },
    {
      t: "msg",
      label: "Studio rules, one short message",
      text: "Fees are due by the 5th for the month. A missed class is not refunded, but you may attend one make-up class a month in another batch at your level if there is room. Please tell us the day before. If we close for a holiday, we will tell you the dates at the start of the month. If you join mid-month, you pay for the weeks that remain. If you need a break, tell us a week before and we will hold your place for one month.",
    },
    {
      t: "p",
      text: "Change the numbers and wording to suit your studio, but keep it short. A message that fits on one screen is one that people actually read.",
    },
    { t: "h2", text: "Tell people at the start, and be consistent" },
    {
      t: "p",
      text: "Send the rules to every new dancer when they join, and pin them in the announcement group. Then apply them the same way each time. If you decide to make an exception, make it clear that it is an exception, and keep a note of it, so that the next dancer who asks gets the same answer.",
    },
    {
      t: "note",
      text: "Keeping an attendance record and a fee record in one place makes these rules easier to apply, because you can see who missed what and who has paid. ChoreoStudio tracks attendance and fees for owner-run dance studios, and the first month is free with no card needed.",
    },
  ],
  faq: [
    {
      q: "Should a dance studio refund fees for missed classes?",
      a: "Most studios do not, because the fee pays for a place in the batch. Many offer one make-up class a month if there is room. Write the rule down and tell dancers when they join.",
    },
    {
      q: "How should I charge a dancer who joins mid-month?",
      a: "Common options are the full month, the weeks that remain, or starting the fee next month. Pick one and apply it to everyone.",
    },
    {
      q: "What should a dance studio do about holidays?",
      a: "Decide whether the fee changes, whether you add a make-up class, or whether closures are already in your yearly pricing, and share the dates at the start of the month.",
    },
  ],
};

const showcase: Post = {
  slug: "how-to-plan-a-dance-showcase",
  title: "How to plan a dance showcase",
  metaTitle: "How to Plan a Dance Showcase for Your Studio | ChoreoStudio",
  description:
    "A showcase gives dancers a goal and your studio a day to be proud of. Here is a timeline, a budget checklist and the mistakes that cost studios the most.",
  date: "2026-10-31",
  readingMinutes: 7,
  related: ["how-to-run-a-dance-studio-in-india", "why-adult-dancers-quit-dance-classes", "how-to-get-your-first-dancers"],
  blocks: [
    {
      t: "p",
      text: "A showcase is the single most useful event a studio can run. It gives dancers something to work towards, gives their friends and family a reason to come, and gives you photos and videos that bring in the next batch. It is also easy to overspend on and easy to leave too late. This guide is a way to plan one without losing money or sleep.",
    },
    { t: "h2", text: "Decide what kind of showcase it is" },
    {
      t: "p",
      text: "It does not have to be a ticketed evening in a large auditorium. A studio showcase can be an open class for friends and family, a performance in your own studio space, a small hall booked for two hours, or a combined event with another studio. Start with the smallest version that would make your dancers proud, and grow it in later years.",
    },
    { t: "h2", text: "A timeline that works backwards from the date" },
    {
      t: "ul",
      items: [
        "Ten to twelve weeks before: choose the date and venue, announce it to your dancers and decide which batches will perform.",
        "Eight weeks before: choose music and routines, and tell each batch what they will perform.",
        "Six weeks before: confirm the venue booking in writing, and start collecting any costume or participation fees.",
        "Four weeks before: finalise the running order and the costumes, and send parents or friends the invitation and the details.",
        "Two weeks before: rehearse in the order you will perform, and check the sound system and music files.",
        "The week of the event: confirm times with everyone, and have one printed running order and a backup copy of every track.",
      ],
    },
    { t: "h2", text: "Budget: list the costs before you promise anything" },
    {
      t: "p",
      text: "Write down every cost you can think of, and then add a margin, because something will always cost more than you expect.",
    },
    {
      t: "ul",
      items: [
        "Venue hire, including the time needed for set-up and rehearsal.",
        "Sound and lighting, and someone to run them on the day.",
        "Costumes, whether the studio buys them or dancers do.",
        "Photographer or videographer, if you want proper photos.",
        "Printing, such as invitations and the running order.",
        "Refreshments or small thank-you gifts for instructors and helpers.",
        "A reserve for the things you did not think of.",
      ],
    },
    {
      t: "p",
      text: "Then decide how it is paid for: a participation fee, ticket sales, sponsors from local businesses, or the studio absorbing it as marketing. Be clear with dancers about what the fee covers before they commit.",
    },
    { t: "h2", text: "Running order and the day itself" },
    {
      t: "p",
      text: "Put the youngest or newest dancers early, when the audience is fresh and the nerves are fewest, and keep a strong piece for the end. Leave a gap between batches for costume changes, and nominate one person to keep time. Plan to start a little late and finish a little late, and tell the venue so.",
    },
    {
      t: "p",
      text: "Ask a few dancers or helpers to take photos and short videos on the day, so you have material for weeks afterwards. Do not rely on a single person with a single phone.",
    },
    { t: "h2", text: "Mistakes to avoid" },
    {
      t: "ul",
      items: [
        "Booking the venue before you know the budget.",
        "Collecting fees with no clear list of who has paid and for what.",
        "Leaving music and sound checks to the last day.",
        "Trying to include every batch in a single long programme.",
        "Skipping a written confirmation with the venue about time, price and cancellation.",
      ],
    },
    { t: "h2", text: "After the showcase" },
    {
      t: "p",
      text: "Send a thank-you message to every dancer and helper within a day. Share the best photos and videos, with the dancers' permission, and ask people who enjoyed the event to bring a friend to a class next month. This is the moment when new dancers are most likely to say yes.",
    },
  ],
  faq: [
    {
      q: "How far in advance should a studio plan a dance showcase?",
      a: "Ten to twelve weeks gives time to book a venue, choose music and routines, and rehearse without rushing.",
    },
    {
      q: "How do dance studios pay for a showcase?",
      a: "Common ways are a participation fee, ticket sales, local sponsors, or the studio covering it as marketing. Tell dancers what any fee covers before they commit.",
    },
    {
      q: "Does a dance showcase need a big venue?",
      a: "No. An open class for friends and family or a performance in your own studio is a good start. Grow it in later years.",
    },
  ],
};

export const posts: Post[] = [
  runStudio,
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
