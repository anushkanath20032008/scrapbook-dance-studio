/** Bump this when the Terms or Privacy Notice change in a way people must agree to again. */
export const TERMS_VERSION = "2026-11-03";

/** The terms in plain words. The full text lives on /terms and /privacy; these are the points that matter most. */
export const TERMS_POINTS: { title: string; body: string }[] = [
  {
    title: "Your records, your responsibility",
    body: "You enter your dancers' details. You are the one who holds that data and decides how it is used. Only add people you have a reason to keep records for, and never health information.",
  },
  {
    title: "We do not touch your dancers' money",
    body: "Fees are paid straight to you. ChoreoStudio only keeps your records and helps you check them. A payment appears only because you recorded it or confirmed a dancer's claim.",
  },
  {
    title: "Reminders go out from you",
    body: "Reminders open in your own WhatsApp with the message filled in. You review and send them. Send only fee and class messages your dancers would expect, and follow WhatsApp's rules and the law.",
  },
  {
    title: "Where your data lives",
    body: "Your data is stored with our providers (Supabase for the database and sign-in, Vercel for hosting). Each studio sees only its own records. Teachers you invite see class and dancer details, never fees or payments.",
  },
  {
    title: "Your plan",
    body: "Subscriptions are billed by Dodo Payments. Card or UPI details go to them, not to us. You can stop using the Service at any time.",
  },
];
