/** The last ten digits of a phone number, or null when there are fewer than ten. Ignores spaces, dashes and +91. */
export function lastTenDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** Whether two phone numbers are the same person's, however they were typed. */
export function sameNumber(a: string, b: string): boolean {
  const x = lastTenDigits(a);
  return x !== null && x === lastTenDigits(b);
}
