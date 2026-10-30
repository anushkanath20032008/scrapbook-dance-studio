// Purchasing-power pricing. India pays in rupees; every other country is placed in one of four bands, each with
// its own dollar price, so a studio in Lagos or Manila is not asked for a London price. Any country not listed
// falls in the highest band. Bands follow the World Bank price level (how much a dollar buys locally).
import type { StudioPlanId } from "./plans";

export type PriceBand = "IN" | "A" | "B" | "C" | "D";
export const DEFAULT_COUNTRY = "IN";

/** Whole US dollars a month for each plan in each non-Indian band. */
const usdByBand: Record<Exclude<PriceBand, "IN">, Record<"starter" | "studio", number>> = {
  A: { starter: 3, studio: 6 },
  B: { starter: 5, studio: 9 },
  C: { starter: 8, studio: 15 },
  D: { starter: 12, studio: 22 },
};

const inrPrice: Record<"starter" | "studio", string> = { starter: "₹249", studio: "₹479" };

const bandCountries: Record<Exclude<PriceBand, "IN" | "D">, string> = {
  // Lowest price level.
  A: "AF BD BF BI BJ BT CD CF CG CI CM EG ER ET GH GM GN GW HT KE KG KH KM LA LK LR LS MG ML MM MN MR MW MZ NE NG NP PK RW SD SL SN SO SS ST SY TD TG TJ TL TZ UG UZ YE ZM ZW",
  // Lower-middle.
  B: "AL AM AO AR AZ BA BO BR BW BY BZ CO CR CU DJ DO DZ EC FJ GA GE GQ GT GY HN ID IQ IR JM JO KZ LB LY MA MD ME MK MV NA NI PE PG PH PS PY SB SR SV SZ TH TM TN TO TR UA VE VN VU WS XK ZA",
  // Upper-middle and southern or eastern Europe.
  C: "BG CL CN CV CZ EE ES GR HR HU IT JP KR LT LV MT MX MY OM PA PL PT RO RS RU SA SI SK TW TT UY BH",
};

// Countries priced at the top band. Listed so they can be offered in a country picker; anything unlisted is also D.
const bandDCountries =
  "AD AE AT AU BE BN BS CA CH CY DE DK FI FR GB IE IL IS KW LI LU MC NL NO NZ QA SE SG SM US HK MO BB";

const bandOf = new Map<string, PriceBand>();
for (const [band, list] of Object.entries(bandCountries)) {
  for (const code of list.split(" ")) bandOf.set(code, band as PriceBand);
}
for (const code of bandDCountries.split(" ")) bandOf.set(code, "D");
bandOf.set("IN", "IN");

/** The price band for a country code (any case); unknown or missing codes get the top band. */
export function bandFor(country: string | null | undefined): PriceBand {
  const code = country?.trim().toUpperCase();
  if (!code) return "IN";
  return bandOf.get(code) ?? "D";
}

/** The monthly price of a sold plan in a band, e.g. "₹249" or "$5". */
export function priceInBand(plan: StudioPlanId, band: PriceBand): string | null {
  if (plan !== "starter" && plan !== "studio") return null;
  if (band === "IN") return inrPrice[plan];
  return `$${usdByBand[band][plan]}`;
}

/** Every country the picker offers, as ISO codes. */
export const pickerCountries: readonly string[] = [...bandOf.keys()].sort();

const names = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

export function countryName(code: string): string {
  try {
    return names?.of(code) ?? code;
  } catch {
    return code;
  }
}
