import { describe, expect, it } from "vitest";
import { markReminded, remindedToday, whatsappLink } from "@/lib/manual-reminders";

const row = {
  charge_id: "c1",
  student_name: "Bindu",
  phone: "90909 09090",
  outstanding_paise: 450000,
  due_on: "2026-10-05",
};

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("whatsappLink", () => {
  it("builds a chat link with the studio and the amount in the message", () => {
    const link = whatsappLink(row, "Rhythm House") ?? "";
    expect(link.startsWith("https://wa.me/919090909090?text=")).toBe(true);
    const text = decodeURIComponent(link.split("text=")[1] ?? "");
    expect(text).toBe("Hi Bindu, a reminder from Rhythm House: your fee of ₹4,500 was due on 5 Oct. Thank you!");
  });

  it("leaves the studio out when it has no name", () => {
    const text = decodeURIComponent((whatsappLink(row) ?? "").split("text=")[1] ?? "");
    expect(text).toBe("Hi Bindu, a reminder: your fee of ₹4,500 was due on 5 Oct. Thank you!");
  });

  it("handles a leading zero and a country code, and refuses a number that cannot be used", () => {
    expect(whatsappLink({ ...row, phone: "09090909090" })).toContain("wa.me/919090909090");
    expect(whatsappLink({ ...row, phone: "+91 90909 09090" })).toContain("wa.me/919090909090");
    expect(whatsappLink({ ...row, phone: "12345" })).toBeNull();
    expect(whatsappLink({ ...row, phone: null })).toBeNull();
  });
});

describe("reminder log", () => {
  it("remembers what was opened today and forgets it tomorrow", () => {
    const store = memory();
    expect(remindedToday("2026-10-20", store).size).toBe(0);
    markReminded("c1", "2026-10-20", store);
    markReminded("c2", "2026-10-20", store);
    expect([...remindedToday("2026-10-20", store)].sort()).toEqual(["c1", "c2"]);
    expect(remindedToday("2026-10-21", store).size).toBe(0);
  });

  it("copes with a broken or missing store", () => {
    expect(remindedToday("2026-10-20", null).size).toBe(0);
    expect(markReminded("c1", "2026-10-20", null).has("c1")).toBe(true);
    const broken = { getItem: () => "not json", setItem: () => { throw new Error("full"); } };
    expect(remindedToday("2026-10-20", broken).size).toBe(0);
    expect(() => markReminded("c1", "2026-10-20", broken)).not.toThrow();
  });
});
