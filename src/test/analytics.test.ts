import { describe, expect, it } from "vitest";
import { isAnalyticsPath, readConsent, shouldLoadAnalytics, writeConsent } from "@/components/analytics";

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

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

describe("analytics consent", () => {
  it("is off until the visitor says yes", () => {
    expect(shouldLoadAnalytics("/", null)).toBe(false);
    expect(shouldLoadAnalytics("/", "no")).toBe(false);
    expect(shouldLoadAnalytics("/", "yes")).toBe(true);
  });

  it("stays off in the console even after a yes", () => {
    expect(shouldLoadAnalytics("/app", "yes")).toBe(false);
    expect(shouldLoadAnalytics("/family/abc", "yes")).toBe(false);
  });

  it("remembers the choice and ignores anything unexpected", () => {
    const store = memory();
    expect(readConsent(store)).toBeNull();
    writeConsent("yes", store);
    expect(readConsent(store)).toBe("yes");
    writeConsent("no", store);
    expect(readConsent(store)).toBe("no");
    store.setItem("choreo-analytics-consent", "maybe");
    expect(readConsent(store)).toBeNull();
  });

  it("copes with storage that is blocked", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readConsent(broken)).toBeNull();
    expect(() => writeConsent("yes", broken)).not.toThrow();
    expect(readConsent(null)).toBeNull();
  });
});
