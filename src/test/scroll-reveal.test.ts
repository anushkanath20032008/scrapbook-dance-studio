import { describe, expect, it } from "vitest";
import { isDue, revealDelay } from "@/lib/scroll-reveal";

describe("revealDelay", () => {
  it("staggers a row of siblings and never waits more than a third of a second", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(revealDelay)).toEqual([0, 90, 180, 270, 360, 360, 360]);
    expect(revealDelay(-1)).toBe(0);
  });
});

describe("isDue", () => {
  it("is due when the top edge is in view or already scrolled past, so a jump never leaves a section hidden", () => {
    expect(isDue(100, 800)).toBe(true);
    expect(isDue(-2000, 800)).toBe(true);
    expect(isDue(790, 800)).toBe(false);
    expect(isDue(1500, 800)).toBe(false);
  });
});
