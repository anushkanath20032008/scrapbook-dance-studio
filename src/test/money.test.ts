import { describe, expect, it } from "vitest";
import { formatRupees, parseRupees } from "@/lib/money";

describe("formatRupees", () => {
  it("uses Indian digit grouping and drops empty paise", () => {
    expect(formatRupees(150000)).toBe("₹1,500");
    expect(formatRupees(12345600)).toBe("₹1,23,456");
    expect(formatRupees(0)).toBe("₹0");
  });

  it("keeps two decimals when there are paise, and marks credit as negative", () => {
    expect(formatRupees(150050)).toBe("₹1,500.50");
    expect(formatRupees(-50000)).toBe("-₹500");
  });
});

describe("parseRupees", () => {
  it("reads typed amounts as whole paise", () => {
    expect(parseRupees("1,500")).toBe(150000);
    expect(parseRupees("₹ 1500.5")).toBe(150050);
    expect(parseRupees("0.99")).toBe(99);
  });

  it("refuses anything that is not a plain amount", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e3", "12.", "1,5,0.0.0"]) {
      expect(parseRupees(bad), bad).toBeNull();
    }
  });
});
