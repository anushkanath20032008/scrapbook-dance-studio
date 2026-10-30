// International pricing. Plans are priced in rupees; Dodo's Adaptive Currency converts at checkout using the
// customer's billing country, so the rupee price stays the single source of truth. What we show a visitor
// abroad is an approximation to set expectations; the exact amount (plus any tax) is on Dodo's checkout page.

/** Rupees per one unit of each currency. Approximate and for display only, never for charging. */
const inrPerUnit = { USD: 95, EUR: 102, GBP: 118, AED: 24, AUD: 58, CAD: 64, SGD: 68 } as const;
export type DisplayCurrency = keyof typeof inrPerUnit;

const eurozone = "AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK".split(" ");
const byCountry: Record<string, DisplayCurrency> = {
  US: "USD",
  GB: "GBP",
  AE: "AED",
  AU: "AUD",
  CA: "CAD",
  SG: "SGD",
  ...Object.fromEntries(eurozone.map((c) => [c, "EUR" as const])),
};

/** A two-letter country code from a CDN header, or null when it is missing, unknown or not a country. */
export function cleanCountry(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "T1" ? code : null;
}

/** The currency to quote a visitor from this country in. India and unknown countries stay in rupees. */
export function currencyForCountry(country: string | null): DisplayCurrency | null {
  const code = cleanCountry(country);
  if (!code || code === "IN") return null;
  return byCountry[code] ?? "USD";
}

/** "about $3" style text for a rupee price, or null when the visitor should just see rupees. */
export function approximatePrice(rupees: number, country: string | null): string | null {
  const currency = currencyForCountry(country);
  if (!currency) return null;
  const amount = rupees / inrPerUnit[currency];
  const rounded = amount < 10 ? Math.round(amount * 2) / 2 : Math.round(amount);
  const text = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  return `about ${text}`;
}

/** The rupee amount in a plan's display price, e.g. "₹249" -> 249. */
export function rupeesIn(price: string): number {
  return Number(price.replace(/[^\d]/g, "")) || 0;
}
