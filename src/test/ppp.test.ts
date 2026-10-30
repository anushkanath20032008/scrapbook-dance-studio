import { describe, expect, it } from "vitest";
import { bandFor, pickerCountries, priceInBand } from "@/lib/ppp";

describe("purchasing-power pricing", () => {
  it("keeps India in rupees", () => {
    expect(bandFor("IN")).toBe("IN");
    expect(bandFor("in")).toBe("IN");
    expect(priceInBand("starter", "IN")).toBe("₹249");
    expect(priceInBand("studio", "IN")).toBe("₹479");
  });

  it("charges less where a dollar buys more", () => {
    const rank = ["A", "B", "C", "D"] as const;
    const prices = rank.map((band) => Number(priceInBand("starter", band)?.slice(1)));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(new Set(prices).size).toBe(4);
    expect(bandFor("NG")).toBe("A");
    expect(bandFor("PH")).toBe("B");
    expect(bandFor("MX")).toBe("C");
    expect(bandFor("US")).toBe("D");
  });

  it("puts every country, listed or not, in a band", () => {
    expect(bandFor("ZZ")).toBe("D");
    expect(bandFor(null)).toBe("IN");
    for (const code of pickerCountries) expect(["IN", "A", "B", "C", "D"]).toContain(bandFor(code));
  });

  it("has no price for a plan that is not sold", () => {
    expect(priceInBand("growth", "A")).toBeNull();
  });
});
