import { describe, expect, it } from "vitest";
import {
  addableDancers,
  normalizePhone,
  parseDancerList,
  suggestFeeRupees,
} from "@/lib/bulk-dancers";

describe("normalizePhone", () => {
  it("formats Indian mobiles however they are typed", () => {
    expect(normalizePhone("98765 43210")).toBe("+91 98765 43210");
    expect(normalizePhone("+91-98765-43210")).toBe("+91 98765 43210");
    expect(normalizePhone("098765 43210")).toBe("+91 98765 43210");
    expect(normalizePhone("919876543210")).toBe("+91 98765 43210");
  });
  it("keeps other international numbers only with a plus sign", () => {
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
    expect(normalizePhone("447911123456")).toBeNull();
  });
  it("refuses numbers that cannot be a mobile", () => {
    expect(normalizePhone("12345 67890")).toBeNull();
    expect(normalizePhone("98765")).toBeNull();
  });
});

describe("parseDancerList", () => {
  it("reads name, phone and fee in commas, tabs or plain spaces", () => {
    const rows = parseDancerList(
      [
        "Asha Rao, 98765 43210, 1,800",
        "Bela Shah\t+91 91234 56789\t₹2500",
        "Chirag - 99887 76655",
        "Dia Menon 9812345678 1500",
      ].join("\n"),
    );
    expect(rows.map((row) => [row.name, row.phone, row.feePaise])).toEqual([
      ["Asha Rao", "+91 98765 43210", 180000],
      ["Bela Shah", "+91 91234 56789", 250000],
      ["Chirag", "+91 99887 76655", null],
      ["Dia Menon", "+91 98123 45678", 150000],
    ]);
    expect(rows.every((row) => row.problem === null)).toBe(true);
  });

  it("accepts a name with no phone, and skips blank lines and list numbers", () => {
    const rows = parseDancerList("\n1. Esha K\n\n2) Farah\n");
    expect(rows.map((row) => [row.name, row.phone, row.line])).toEqual([
      ["Esha K", null, 2],
      ["Farah", null, 4],
    ]);
  });

  it("flags lines it cannot use instead of guessing", () => {
    const rows = parseDancerList("98765 43210\nGita 12345 67890\nHari 9876543\nIna 150000");
    expect(rows[0]?.problem).toMatch(/name/i);
    expect(rows[1]?.problem).toMatch(/phone/i);
    expect(rows[2]?.problem).toMatch(/phone/i);
    expect(rows[3]?.problem).toMatch(/fee/i);
    expect(addableDancers(rows)).toHaveLength(0);
  });

  it("flags the same dancer pasted twice but allows two people on one phone", () => {
    const rows = parseDancerList("Jaya, 98765 43210\nJaya, 98765 43210\nJiya, 98765 43210");
    expect(rows.map((row) => row.problem === null)).toEqual([true, false, true]);
    expect(addableDancers(rows)).toHaveLength(2);
  });
});

describe("suggestFeeRupees", () => {
  it("starts from a round figure, or the fee most dancers already pay", () => {
    expect(suggestFeeRupees([])).toBe("1500");
    expect(suggestFeeRupees([200000, 150000, 200000])).toBe("2000");
  });
});
