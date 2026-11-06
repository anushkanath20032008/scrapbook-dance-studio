// Shapes and small pure helpers behind the Studio table on the home page. The teacher version has no money
// fields at all (not just hidden ones), so nothing about fees can reach a teacher's screen.

export type PayStatus = "paid" | "due" | "overdue" | "none";

export type TableRow = {
  studentId: string;
  name: string;
  feePaise: number;
  outstandingPaise: number;
  status: PayStatus;
  /** True or false once attendance is marked today, null when not marked yet. */
  present: boolean | null;
};

export type TableBatch = {
  id: string;
  name: string;
  weekdays: number[];
  startsAt: string | null;
  endsAt: string | null;
  meetsToday: boolean;
  rows: TableRow[];
};

export type TeacherRow = { studentId: string; name: string; present: boolean | null };
export type TeacherBatch = Omit<TableBatch, "rows"> & { rows: TeacherRow[] };

export type TableFilter = "all" | "unpaid" | "paid" | "today";

export const FILTERS: { id: TableFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unpaid", label: "Unpaid only" },
  { id: "paid", label: "Paid" },
  { id: "today", label: "Today's classes" },
];

export const owes = (row: TableRow) => row.outstandingPaise > 0;

export function batchTotals(rows: TableRow[]) {
  const unpaid = rows.filter(owes);
  return {
    count: rows.length,
    paid: rows.length - unpaid.length,
    unpaid: unpaid.length,
    duePaise: unpaid.reduce((sum, row) => sum + row.outstandingPaise, 0),
  };
}

/** Which batches and rows a filter chip keeps. Batches left with no rows are dropped. */
export function applyFilter(batches: TableBatch[], filter: TableFilter): TableBatch[] {
  if (filter === "all") return batches;
  if (filter === "today") return batches.filter((batch) => batch.meetsToday);
  const keep = filter === "unpaid" ? owes : (row: TableRow) => !owes(row);
  return batches
    .map((batch) => ({ ...batch, rows: batch.rows.filter(keep) }))
    .filter((batch) => batch.rows.length > 0);
}

/** Everyone in the shown batches who owes money, once even if they are in two batches. */
export function unpaidAcross(batches: TableBatch[]): TableRow[] {
  const seen = new Map<string, TableRow>();
  for (const batch of batches) for (const row of batch.rows) if (owes(row)) seen.set(row.studentId, row);
  return [...seen.values()];
}

export const UNDO_WINDOW_MS = 10 * 60 * 1000;
