import { describe, expect, it } from "vitest";
import {
  formatDay,
  formatDayWithYear,
  formatMonthLong,
  formatMonthShort,
  paymentMethodLabel,
} from "@/lib/format";

describe("display formatting", () => {
  it("reads ISO dates as calendar days, never shifted by timezone", () => {
    expect(formatDay("2026-10-01")).toBe("1 Oct");
    expect(formatDay("2026-12-31")).toBe("31 Dec");
    expect(formatDayWithYear("2026-10-05")).toBe("5 Oct 2026");
  });

  it("formats a month long and short", () => {
    expect(formatMonthLong("2026-10-01")).toBe("October 2026");
    expect(formatMonthShort("2026-10-01")).toBe("Oct 26");
  });

  it("labels each stored payment method and passes an unknown one through", () => {
    expect(paymentMethodLabel("upi")).toBe("UPI");
    expect(paymentMethodLabel("bank")).toBe("bank transfer");
    expect(paymentMethodLabel("cash")).toBe("cash");
    expect(paymentMethodLabel("cheque")).toBe("cheque");
  });
});
