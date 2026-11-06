// The rows behind the "add dancers" table: plain text cells, pasting from a spreadsheet or a typed list, and the
// checks that turn them into dancers ready for review. Pure so it can be tested without a screen.

import { normalizePhone, parseDancerList } from "./bulk-dancers";
import { parseRupees } from "./money";

export type ColumnId =
  | "name"
  | "phone"
  | "fee"
  | "email"
  | "joinedOn"
  | "emergencyName"
  | "emergencyPhone"
  | "note";

export type GridRow = Record<ColumnId, string>;

export const COLUMNS: { id: ColumnId; label: string; width: number; aliases: string[] }[] = [
  { id: "name", label: "Name", width: 180, aliases: ["name", "dancer", "student", "full name"] },
  { id: "phone", label: "Phone", width: 150, aliases: ["phone", "mobile", "number", "phone number", "contact", "whatsapp"] },
  { id: "fee", label: "Monthly fee (₹)", width: 130, aliases: ["fee", "monthly fee", "fees", "amount", "monthly fee (₹)"] },
  { id: "email", label: "Email", width: 190, aliases: ["email", "e-mail", "email id"] },
  { id: "joinedOn", label: "Joined on", width: 140, aliases: ["joined", "joined on", "join date", "start date", "date of joining"] },
  { id: "emergencyName", label: "Emergency contact", width: 170, aliases: ["emergency", "emergency contact", "emergency name"] },
  { id: "emergencyPhone", label: "Emergency phone", width: 150, aliases: ["emergency phone", "emergency number"] },
  { id: "note", label: "Note", width: 220, aliases: ["note", "notes", "remarks", "comment"] },
];

export const DEFAULT_VISIBLE: ColumnId[] = ["name", "phone", "fee"];
export const MAX_GRID_ROWS = 200;

export const emptyRow = (): GridRow => ({
  name: "",
  phone: "",
  fee: "",
  email: "",
  joinedOn: "",
  emergencyName: "",
  emergencyPhone: "",
  note: "",
});

const isBlank = (row: GridRow) => Object.values(row).every((cell) => cell.trim() === "");

export type GridDancer = {
  index: number;
  name: string;
  phone: string | null;
  feePaise: number | null;
  email: string | null;
  joinedOn: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  note: string | null;
  /** What is wrong with this row, in words the owner can act on. Null when it can be added. */
  problem: string | null;
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function realDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/** Day/month/year or day-month-year, as people write them in India, becomes year-month-day. */
export function normalizeDate(text: string): string {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  if (!m) return text.trim();
  return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

/** Checks every non-empty row. A second row with the same name and phone is flagged so nobody is added twice. */
export function checkGrid(rows: GridRow[]): GridDancer[] {
  const seen = new Set<string>();
  const out: GridDancer[] = [];
  rows.forEach((row, index) => {
    if (isBlank(row)) return;
    let problem: string | null = null;
    const name = row.name.replace(/\s+/g, " ").trim();
    if (name === "") problem = "No name on this row";
    else if (name.length > 120) problem = "That name is too long";

    const phoneText = row.phone.trim();
    const phone = phoneText === "" ? null : normalizePhone(phoneText);
    if (phoneText !== "" && phone === null) problem ??= "That phone number does not look right";

    const feeText = row.fee.trim();
    let feePaise: number | null = null;
    if (feeText !== "") {
      feePaise = parseRupees(feeText.replace(/^₹\s*/, ""));
      if (feePaise === null || feePaise <= 0 || feePaise > 10_000_000) {
        feePaise = null;
        problem ??= "That fee does not look right";
      }
    }

    const emailText = row.email.trim();
    if (emailText !== "" && (!EMAIL.test(emailText) || emailText.length > 200))
      problem ??= "That email does not look right";

    const joinedText = normalizeDate(row.joinedOn);
    if (joinedText !== "" && !realDate(joinedText)) problem ??= "Write the joining date as day/month/year";

    const emergencyPhoneText = row.emergencyPhone.trim();
    const emergencyPhone = emergencyPhoneText === "" ? null : normalizePhone(emergencyPhoneText);
    if (emergencyPhoneText !== "" && emergencyPhone === null)
      problem ??= "That emergency phone does not look right";

    if (row.emergencyName.trim().length > 120) problem ??= "That emergency contact name is too long";
    if (row.note.trim().length > 500) problem ??= "That note is too long (500 letters at most)";

    if (!problem) {
      const key = `${name.toLowerCase()}|${phone ?? ""}`;
      if (seen.has(key)) problem = "Already on the list above";
      seen.add(key);
    }
    out.push({
      index,
      name,
      phone,
      feePaise,
      email: emailText === "" ? null : emailText,
      joinedOn: joinedText === "" ? null : joinedText,
      emergencyName: row.emergencyName.trim() === "" ? null : row.emergencyName.trim(),
      emergencyPhone,
      note: row.note.trim() === "" ? null : row.note.trim(),
      problem,
    });
  });
  return out;
}

export const addableFromGrid = (dancers: GridDancer[]) => dancers.filter((d) => d.problem === null);

const headerColumn = (cell: string): ColumnId | null => {
  const key = cell.trim().toLowerCase();
  return COLUMNS.find((c) => c.aliases.includes(key))?.id ?? null;
};

/**
 * Put pasted text into the grid starting at a cell. Text copied from a spreadsheet (tabs between cells) fills
 * across the shown columns, or by column heading when the first row is headings. A plain typed list is read line
 * by line the forgiving way. Returns the new rows and any columns the paste needs shown.
 */
export function pasteIntoGrid(
  rows: GridRow[],
  startRow: number,
  startColumn: ColumnId,
  shown: ColumnId[],
  text: string,
): { rows: GridRow[]; shown: ColumnId[] } {
  const lines = text.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  if (lines.length === 0) return { rows, shown };

  const next = rows.map((row) => ({ ...row }));
  const ensure = (at: number) => {
    while (next.length <= at && next.length < MAX_GRID_ROWS) next.push(emptyRow());
  };
  let nextShown = shown;

  if (!text.includes("\t")) {
    if (lines.length === 1 && !/\d{6,}/.test(lines[0]!)) {
      // One short piece of text lands in the cell that was clicked.
      ensure(startRow);
      next[startRow]![startColumn] = lines[0]!.trim();
      return { rows: next, shown };
    }
    parseDancerList(lines.join("\n")).forEach((parsed, i) => {
      const at = startRow + i;
      ensure(at);
      if (at >= next.length) return;
      const row = next[at]!;
      row.name = parsed.name;
      row.phone = parsed.phone ?? "";
      row.fee = parsed.feePaise === null ? "" : String(parsed.feePaise / 100);
    });
    const needed = (["phone", "fee"] as ColumnId[]).filter(
      (c) => !nextShown.includes(c) && next.some((r) => r[c] !== ""),
    );
    if (needed.length > 0) nextShown = [...nextShown, ...needed];
    return { rows: next, shown: nextShown };
  }

  const cells = lines.map((line) => line.split("\t"));
  const headings = cells[0]!.map(headerColumn);
  const hasHeader = headings.every((h) => h !== null) && headings.includes("name");
  if (hasHeader) {
    const cols = headings as ColumnId[];
    nextShown = [...nextShown, ...cols.filter((c) => !nextShown.includes(c))];
    cells.slice(1).forEach((line, i) => {
      const at = startRow + i;
      ensure(at);
      if (at >= next.length) return;
      line.forEach((cell, j) => {
        const col = cols[j];
        if (col) next[at]![col] = cell.trim();
      });
    });
    return { rows: next, shown: nextShown };
  }
  const startAt = Math.max(0, shown.indexOf(startColumn));
  cells.forEach((line, i) => {
    const at = startRow + i;
    ensure(at);
    if (at >= next.length) return;
    line.forEach((cell, j) => {
      const col = shown[startAt + j];
      if (col) next[at]![col] = cell.trim();
    });
  });
  return { rows: next, shown: nextShown };
}
