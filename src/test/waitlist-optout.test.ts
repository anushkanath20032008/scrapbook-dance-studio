import { describe, expect, it } from "vitest";
import { lastTenDigits, sameNumber } from "@/lib/waitlist-optout";

describe("matching a phone number to an opt-out request", () => {
  it("ignores spaces, dashes, the plus and the country code", () => {
    expect(lastTenDigits("+91 98765-43210")).toBe("9876543210");
    expect(sameNumber("+91 98765 43210", "9876543210")).toBe(true);
    expect(sameNumber("09876543210", "+919876543210")).toBe(true);
  });

  it("does not match different numbers or numbers that are too short", () => {
    expect(sameNumber("9876543210", "9876543211")).toBe(false);
    expect(lastTenDigits("12345")).toBeNull();
    expect(sameNumber("12345", "12345")).toBe(false);
  });
});
