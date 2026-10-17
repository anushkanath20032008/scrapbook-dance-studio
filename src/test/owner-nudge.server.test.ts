import { describe, expect, it, vi } from "vitest";
import {
  composeNudge,
  getMailer,
  runOwnerNudge,
  shouldNudge,
  type NudgeSummary,
} from "@/lib/owner-nudge.server";

const row = (over: Partial<NudgeSummary> = {}): NudgeSummary => ({
  studio_id: "s1",
  unpaid_count: 3,
  outstanding_paise: 450000,
  due_today_count: 0,
  overdue_count: 1,
  ...over,
});
const MONDAY = "2026-10-12";
const TUESDAY = "2026-10-13";

describe("shouldNudge", () => {
  it("nudges on a due date and on Mondays while anyone is unpaid", () => {
    expect(shouldNudge(row({ due_today_count: 2 }), TUESDAY)).toBe(true);
    expect(shouldNudge(row(), MONDAY)).toBe(true);
  });
  it("stays quiet on other days and when nobody is unpaid", () => {
    expect(shouldNudge(row(), TUESDAY)).toBe(false);
    expect(shouldNudge(row({ unpaid_count: 0, due_today_count: 0 }), MONDAY)).toBe(false);
  });
});

describe("composeNudge", () => {
  it("names the count, the total and where to act", () => {
    const mail = composeNudge(row(), { email: "o@x.in", studioName: "Rhythm House" }, "https://x.in");
    expect(mail.to).toBe("o@x.in");
    expect(mail.subject).toBe("3 dancers haven't paid this month");
    expect(mail.text).toContain("₹4,500");
    expect(mail.text).toContain("1 already overdue");
    expect(mail.text).toContain("https://x.in/app");
  });
});

describe("runOwnerNudge", () => {
  const owner = async () => ({ email: "o@x.in", studioName: "Rhythm House" });

  it("sends nothing and says so when no mailer is configured", async () => {
    const summary = vi.fn();
    expect(
      await runOwnerNudge({ summary, owner, mailer: null, today: MONDAY, appUrl: "https://x.in" }),
    ).toEqual({ status: "mailer_not_configured" });
    expect(summary).not.toHaveBeenCalled();
  });

  it("emails the studios that need a nudge and counts the rest", async () => {
    const send = vi.fn(async () => ({ ok: true }));
    const result = await runOwnerNudge({
      summary: async () => [row(), row({ studio_id: "s2", unpaid_count: 0 })],
      owner,
      mailer: { send },
      today: MONDAY,
      appUrl: "https://x.in",
    });
    expect(result).toEqual({ status: "ok", studios: 2, sent: 1, skipped: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("counts a failed send without stopping the rest", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ ok: true });
    const result = await runOwnerNudge({
      summary: async () => [row(), row({ studio_id: "s2" })],
      owner,
      mailer: { send },
      today: MONDAY,
      appUrl: "https://x.in",
    });
    expect(result).toMatchObject({ sent: 1, failed: 1 });
  });
});

describe("getMailer", () => {
  it("needs both the key and the sender address", () => {
    expect(getMailer({ RESEND_API_KEY: "k" })).toBeNull();
    expect(getMailer({ RESEND_API_KEY: "k", NUDGE_FROM_EMAIL: "a@b.in" })).not.toBeNull();
  });
});
