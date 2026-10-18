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
