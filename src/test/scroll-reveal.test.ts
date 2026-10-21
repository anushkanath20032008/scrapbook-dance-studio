import { describe, expect, it } from "vitest";
import { revealDelay } from "@/lib/scroll-reveal";

describe("revealDelay", () => {
  it("staggers a row of siblings and never waits more than a third of a second", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(revealDelay)).toEqual([0, 90, 180, 270, 360, 360, 360]);
    expect(revealDelay(-1)).toBe(0);
  });
});
