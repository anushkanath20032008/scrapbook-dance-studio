// Display formatting shared by the console screens. Client-safe. Dates are ISO strings (YYYY-MM-DD) read as
// local calendar days, so a date never shifts across a timezone.

const toDate = (iso: string) => new Date(`${iso}T00:00:00`);

/** "5 Oct" */
export const formatDay = (iso: string) =>
  toDate(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** "5 Oct 2026" */
export const formatDayWithYear = (iso: string) =>
  toDate(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** "October 2026" */
export const formatMonthLong = (period: string) =>
  toDate(period).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/** "Oct 26" */
export const formatMonthShort = (period: string) =>
  toDate(period).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

/** How an owner reads a payment method; the stored values are cash, upi, bank and other. */
export const paymentMethodLabels: Record<string, string> = {
  cash: "cash",
  upi: "UPI",
  bank: "bank transfer",
  other: "other",
};

export const paymentMethodLabel = (method: string) => paymentMethodLabels[method] ?? method;

/** "Thursday, 5 November" */
export const formatDayLong = (iso: string) =>
  toDate(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

/** A phone number with the middle hidden ("+91 ••••• 90869"), for screens where the number only needs recognising. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "•••••";
  const prefix = phone.trim().startsWith("+") ? `+${digits.slice(0, digits.length - 10)} ` : "";
  return `${prefix}••••• ${digits.slice(-5)}`.trim();
}
