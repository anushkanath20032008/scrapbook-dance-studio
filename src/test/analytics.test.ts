import { describe, expect, it } from "vitest";
import { isAnalyticsPath } from "@/components/analytics";

describe("analytics pages", () => {
  it("runs on the public pages", () => {
    for (const path of ["/", "/login", "/privacy", "/terms", "/login/"])
      expect(isAnalyticsPath(path)).toBe(true);
  });

  it("never runs where dancers' names, numbers or payments are on screen", () => {
    for (const path of ["/app", "/app/students", "/app/billing", "/app/verify", "/family/abc", "/account", "/admin", "/reset-password", "/opt-out"])
      expect(isAnalyticsPath(path)).toBe(false);
  });
});
