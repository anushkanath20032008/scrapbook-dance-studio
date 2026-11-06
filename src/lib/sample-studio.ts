import type { StripNumbers } from "@/components/console/month-strip";
import type { PayStatus, TableBatch, TableRow } from "@/lib/studio-table";

// A made-up studio for practising and for demos. It lives only in the page's memory: nothing is saved, no
// WhatsApp opens, and leaving the sample puts the real studio back exactly as it was.

const person = (
  id: string,
  name: string,
  feePaise: number,
  status: PayStatus,
  present: boolean | null = null,
): TableRow => ({
  studentId: `sample-${id}`,
  name,
  feePaise,
  outstandingPaise: status === "due" || status === "overdue" ? feePaise : 0,
  status,
  present,
});

export function sampleBatches(): TableBatch[] {
  const base = { weekdays: [1, 3, 5], startsAt: null, endsAt: null, meetsToday: true };
  return [
    {
      ...base,
      id: "sample-adults",
      name: "Adults",
      rows: [
        person("anaya", "Anaya", 300000, "overdue"),
        person("meera", "Meera", 300000, "due", true),
        person("rohan", "Rohan", 300000, "paid", true),
        person("sana", "Sana", 300000, "due"),
      ],
    },
    {
      ...base,
      id: "sample-kids",
      name: "Under 10",
      rows: [
        person("diya", "Diya", 250000, "due", true),
        person("kabir", "Kabir", 250000, "paid"),
        person("ishaan", "Ishaan", 250000, "overdue"),
        person("vihaan", "Vihaan", 250000, "paid", true),
      ],
    },
  ];
}

/** The month strip for the sample, worked out from the rows so it moves when a payment is recorded. */
export function sampleNumbers(batches: TableBatch[]): StripNumbers {
  const seen = new Map<string, TableRow>();
  for (const batch of batches) for (const row of batch.rows) seen.set(row.studentId, row);
  const rows = [...seen.values()];
  const billed = rows.reduce((sum, row) => sum + row.feePaise, 0);
  const owed = rows.reduce((sum, row) => sum + row.outstandingPaise, 0);
  const overdue = rows
    .filter((row) => row.status === "overdue")
    .reduce((sum, row) => sum + row.outstandingPaise, 0);
  return {
    missing_paise: owed,
    overdue_paise: overdue,
    billed_paise: billed,
    collected_paise: billed - owed,
    paid_students: rows.filter((row) => row.status === "paid").length,
    charged_students: rows.length,
    active_students: rows.length,
    ongoing_batches: batches.length,
  };
}

/** Marks one sample dancer as having paid in full. */
export function samplePay(batches: TableBatch[], studentId: string): TableBatch[] {
  return batches.map((batch) => ({
    ...batch,
    rows: batch.rows.map((row) =>
      row.studentId === studentId ? { ...row, outstandingPaise: 0, status: "paid" as const } : row,
    ),
  }));
}

export function sampleMark(
  batches: TableBatch[],
  batchId: string,
  studentId: string,
  present: boolean,
): TableBatch[] {
  return batches.map((batch) =>
    batch.id !== batchId
      ? batch
      : {
          ...batch,
          rows: batch.rows.map((row) => (row.studentId === studentId ? { ...row, present } : row)),
        },
  );
}

export const isSampleId = (studentId: string) => studentId.startsWith("sample-");
