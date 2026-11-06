import { describe, expect, it } from "vitest";
import { buildNotes } from "@/components/console/notifications";
import type { TableBatch } from "@/lib/studio-table";

const batch = (name: string, present: boolean | null, meetsToday = true): TableBatch => ({
  id: `b-${name}`,
  name,
  weekdays: [1],
  startsAt: null,
  endsAt: null,
  meetsToday,
  rows: [
    {
      studentId: `s-${name}`,
      name: "Anaya",
      feePaise: 300000,
      outstandingPaise: 0,
      status: "paid",
      present,
    },
  ],
});

const base = { claims: [], batches: [], unpaidCount: 0, outstandingPaise: 0, charged: true };

describe("what the studio is told about", () => {
  it("says nothing when there is nothing to do", () => {
    expect(buildNotes(base)).toEqual([]);
  });

  it("names a dancer who says they paid", () => {
    const notes = buildNotes({
      ...base,
      claims: [{ claim_id: "c1", student_name: "Pushpak", amount_paise: 500000 }],
    });
    expect(notes[0]?.text).toContain("Pushpak");
    expect(notes[0]?.text).toContain("₹5,000");
    expect(notes[0]?.tone).toBe("warn");
  });

  it("points out a class nobody has marked", () => {
    const notes = buildNotes({ ...base, batches: [batch("Adults", null)] });
    expect(notes.some((note) => note.text.includes("Adults"))).toBe(true);
  });

  it("leaves a marked class, and a class not meeting today, alone", () => {
    expect(buildNotes({ ...base, batches: [batch("Adults", true)] })).toEqual([]);
    expect(buildNotes({ ...base, batches: [batch("Adults", null, false)] })).toEqual([]);
  });

  it("warns when the month's fees were never added, instead of counting what is owed", () => {
    const notes = buildNotes({ ...base, charged: false, unpaidCount: 3, outstandingPaise: 900000 });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.id).toBe("charges");
  });

  it("counts what is still owed once fees are added", () => {
    const notes = buildNotes({ ...base, unpaidCount: 3, outstandingPaise: 900000 });
    expect(notes[0]?.text).toBe("3 dancers still owe ₹9,000.");
  });
});
