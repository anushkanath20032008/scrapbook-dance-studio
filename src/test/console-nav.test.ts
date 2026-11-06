import { describe, expect, it } from "vitest";

import { consoleGroups, groupForPath, groupTabs, navLabels } from "@/lib/console-nav";

describe("console nav groups", () => {
  it("has four group entries, with no separate Payments menu", () => {
    expect(consoleGroups.map((group) => group.label)).toEqual([
      "Home",
      "Batches",
      "Attendance",
      "Studio",
    ]);
  });

  it("keeps every old money page reachable, under a group", () => {
    for (const path of ["/app/batches", "/app/students", "/app/plans"])
      expect(groupForPath(path)).toBe("batches");
    for (const path of ["/app/makeups", "/app/team", "/app/messages", "/account"])
      expect(groupForPath(path)).toBe("studio");
    // The old money pages still open by link; they belong to Home now.
    for (const path of ["/app/billing", "/app/verify", "/app/month-end", "/app/insights"])
      expect(groupForPath(path)).toBe("overview");
    expect(groupForPath("/app")).toBe("overview");
    expect(groupForPath("/app/")).toBe("overview");
    expect(groupForPath("/app/attendance")).toBe("attendance");
  });

  it("Batch tabs are Batches, All dancers and Fee plans", () => {
    expect(groupTabs("batches", false).map((tab) => tab.label)).toEqual([
      "Batches",
      "All dancers",
      "Fee plans",
    ]);
  });

  it("Studio tabs end at Account, and show Messages only when messaging is set up", () => {
    expect(groupTabs("studio", false).map((tab) => tab.label)).toEqual([
      "Make-ups",
      "Team",
      "Account",
    ]);
    expect(groupTabs("studio", true).map((tab) => tab.label)).toContain("Messages");
    expect(groupTabs("studio", false).at(-1)?.to).toBe("/account");
  });

  it("other groups have no tab strip", () => {
    expect(groupTabs("overview", true)).toEqual([]);
    expect(groupTabs("attendance", true)).toEqual([]);
  });

  it("uses no accounting jargon in labels", () => {
    for (const label of navLabels) {
      expect(label.toLowerCase()).not.toMatch(/ledger|charge|verify/);
    }
  });
});
