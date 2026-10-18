/** Format a whole-paise amount as rupees with Indian digit grouping, for example 12345600 -> ₹1,23,456. */
export function formatRupees(paise: number): string {
  const negative = paise < 0;
  const absolute = Math.abs(paise);
  const wholeRupees = absolute % 100 === 0;
  const text = (absolute / 100).toLocaleString("en-IN", {
    minimumFractionDigits: wholeRupees ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${negative ? "-" : ""}₹${text}`;
}

/** Turn what an owner types ("1,500" or "1500.50") into whole paise, or null when it is not a valid amount. */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const paise = Math.round(Number(cleaned) * 100);
  return Number.isSafeInteger(paise) ? paise : null;
}
