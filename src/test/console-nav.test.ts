import { describe, expect, it } from "vitest";

import {
  consoleGroups,
  groupForPath,
  groupTabs,
  navLabels,
} from "@/lib/console-nav";

describe("console nav groups", () => {
  it("has exactly five group entries", () => {
    expect(consoleGroups.map((group) => group.label)).toEqual([
      "Overview",
      "Dancers",
      "Payments",
      "Attendance",
      "Studio",
    ]);
  });

  it("maps every old menu path to its group", () => {
    const money = ["/app/billing", "/app/verify", "/app/month-end", "/app/insights", "/app/messages"];
    const studio = ["/app/batches", "/app/plans", "/app/team"];
    for (const path of money) expect(groupForPath(path)).toBe("money");
    for (const path of studio) expect(groupForPath(path)).toBe("studio");
    expect(groupForPath("/app")).toBe("overview");
    expect(groupForPath("/app/")).toBe("overview");
    expect(groupForPath("/app/students")).toBe("dancers");
    expect(groupForPath("/app/attendance")).toBe("attendance");
  });

  it("maps /account to Studio", () => {
    expect(groupForPath("/account")).toBe("studio");
  });

  it("Payments tabs drop Messages when messaging is not configured", () => {
    const without = groupTabs("money", false).map((tab) => tab.label);
    expect(without).toEqual(["Billing", "Payments to check", "Month end", "Insights"]);
    const withMessages = groupTabs("money", true).map((tab) => tab.label);
    expect(withMessages).toContain("Messages");
  });

  it("Studio tabs are Batches, Fee plans, Make-ups, Team and Account", () => {
    expect(groupTabs("studio", false).map((tab) => tab.label)).toEqual([
      "Batches",
      "Fee plans",
      "Make-ups",
      "Team",
      "Account",
    ]);
    expect(groupTabs("studio", false).at(-1)?.to).toBe("/account");
  });

  it("other groups have no tab strip", () => {
    expect(groupTabs("overview", true)).toEqual([]);
    expect(groupTabs("dancers", true)).toEqual([]);
    expect(groupTabs("attendance", true)).toEqual([]);
  });

  it("uses no accounting jargon in labels", () => {
    for (const label of navLabels) {
      expect(label.toLowerCase()).not.toMatch(/ledger|charge|verify/);
    }
  });
});
