export const methodOrder = ["cash", "upi", "bank", "other"] as const;
export type Method = (typeof methodOrder)[number];

export type AgingBucket = { label: string; min: number; max: number | null; paise: number; dancers: number };

const buckets: Omit<AgingBucket, "paise" | "dancers">[] = [
  { label: "1–7 days", min: 1, max: 7 },
  { label: "8–30 days", min: 8, max: 30 },
  { label: "31–60 days", min: 31, max: 60 },
  { label: "Over 60 days", min: 61, max: null },
];

/** Overdue rupees grouped by how late they are. Charges not yet due (0 days) are left out. */
export function overdueAging(
  rows: { student_id: string; outstanding_paise: number; days_overdue: number }[],
): AgingBucket[] {
  return buckets.map((bucket) => {
    const inBucket = rows.filter(
      (row) =>
        row.outstanding_paise > 0 &&
        row.days_overdue >= bucket.min &&
        (bucket.max === null || row.days_overdue <= bucket.max),
    );
    return {
      ...bucket,
      paise: inBucket.reduce((sum, row) => sum + row.outstanding_paise, 0),
      dancers: new Set(inBucket.map((row) => row.student_id)).size,
    };
  });
}

/** Money received in the month by method, always listing all four methods. */
export function collectedByMethod(payments: { amount_paise: number; method: string }[]) {
  const totals: Record<Method, number> = { cash: 0, upi: 0, bank: 0, other: 0 };
  for (const payment of payments) {
    const method = (methodOrder as readonly string[]).includes(payment.method)
      ? (payment.method as Method)
      : "other";
    totals[method] += payment.amount_paise;
  }
  return methodOrder.map((method) => ({ method, paise: totals[method] }));
}

/** Share of billed money that is collected, as a whole percent. Zero when nothing is billed. */
export const collectedPercent = (billed: number, collected: number) =>
  billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 0;
