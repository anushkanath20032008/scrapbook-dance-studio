import { describe, expect, it } from "vitest";
import { approximatePrice, cleanCountry, currencyForCountry, rupeesIn } from "@/lib/pricing";

describe("international pricing", () => {
  it("cleans CDN country headers", () => {
    expect(cleanCountry(" gb ")).toBe("GB");
    expect(cleanCountry("XX")).toBeNull();
    expect(cleanCountry("T1")).toBeNull();
    expect(cleanCountry("")).toBeNull();
    expect(cleanCountry("USA")).toBeNull();
    expect(cleanCountry(null)).toBeNull();
  });

  it("maps countries to a quote currency; India and unknown stay in rupees", () => {
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry("fr")).toBe("EUR");
    expect(currencyForCountry("AE")).toBe("AED");
    expect(currencyForCountry("BR")).toBe("USD");
    expect(currencyForCountry("IN")).toBeNull();
    expect(currencyForCountry(null)).toBeNull();
  });

  it("quotes an approximate local price, nothing for India", () => {
    expect(approximatePrice(249, "US")).toBe("about $2.50");
    expect(approximatePrice(479, "GB")).toBe("about £4");
    expect(approximatePrice(249, "IN")).toBeNull();
    expect(approximatePrice(249, null)).toBeNull();
  });

  it("reads the rupees from a display price", () => {
    expect(rupeesIn("₹249")).toBe(249);
    expect(rupeesIn("₹1,479")).toBe(1479);
  });
});
