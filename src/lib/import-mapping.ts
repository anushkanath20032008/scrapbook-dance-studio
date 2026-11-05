// Reads a dancer spreadsheet (Excel or CSV) the way a person would: looks at each column's heading and at what is
// in it, decides which dancer field it is, and leaves only the columns it is unsure about for the owner to answer.
// Pure, so it can be tested without a screen or a file.

import { normalizePhone } from "./bulk-dancers";
import { checkGrid, emptyRow, MAX_GRID_ROWS, normalizeDate, type GridDancer } from "./dancer-grid";

export type Target =
  | "name"
  | "phone"
  | "fee"
  | "batch"
  | "parent"
  | "email"
  | "joinedOn"
  | "emergencyName"
  | "emergencyPhone"
  | "note"
  | "ignore";

export const TARGETS: { id: Target; label: string }[] = [
  { id: "name", label: "Dancer's name" },
  { id: "phone", label: "Phone (WhatsApp)" },
  { id: "fee", label: "Monthly fee" },
  { id: "batch", label: "Class / batch" },
  { id: "parent", label: "Parent's name" },
  { id: "email", label: "Email" },
  { id: "joinedOn", label: "Joining date" },
  { id: "emergencyName", label: "Emergency contact" },
  { id: "emergencyPhone", label: "Emergency phone" },
  { id: "note", label: "Keep in notes" },
  { id: "ignore", label: "Skip this column" },
];

/** sure: the heading says so. guess: worked out from what is inside. unknown: the owner should decide. */
export type Confidence = "sure" | "guess" | "unknown";

export type ColumnGuess = {
  index: number;
  header: string;
  target: Target;
  confidence: Confidence;
  /** Why, in a few words the owner can read. */
  reason: string;
  /** A few real values, so the owner recognises the column. */
  samples: string[];
};

export type Sheet = { headers: string[]; rows: string[][]; hadHeader: boolean };

export const MAX_IMPORT_ROWS = MAX_GRID_ROWS;

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const has = (text: string, ...needles: string[]) =>
  needles.some((needle) => new RegExp(`\\b${needle}\\b`).test(text));

const PHONE_WORDS = ["phone", "mobile", "whatsapp", "contact", "cell", "number", "no", "mob", "ph"];
const PARENT_WORDS = ["parent", "guardian", "father", "mother", "mom", "dad", "mum", "parents"];

/** What a heading says the column is, or null when it says nothing useful. */
export function targetFromHeader(header: string): Target | null {
  const h = words(header);
  if (
    h === "" ||
    has(
      h,
      "blood",
      "allergy",
      "allergies",
      "address",
      "school",
      "dob",
      "birth",
      "birthday",
      "age",
      "gender",
    )
  )
    return null;
  if (has(h, "emergency", "alternate", "alternative", "secondary")) {
    return has(h, "phone", "mobile", "whatsapp", "cell", "number", "no", "mob", "ph")
      ? "emergencyPhone"
      : "emergencyName";
  }
  if (has(h, ...PARENT_WORDS)) return has(h, ...PHONE_WORDS) ? "phone" : "parent";
  if (has(h, "email", "mail", "e mail")) return "email";
  if (has(h, "phone", "mobile", "whatsapp", "cell", "mob", "contact")) return "phone";
  if (/^(ph|phone|mobile|contact)( no| number)?$/.test(h)) return "phone";
  if (has(h, "fee", "fees", "tuition", "amount", "monthly", "charges", "charge", "rate", "payable"))
    return "fee";
  if (
    has(
      h,
      "batch",
      "batches",
      "class",
      "classes",
      "group",
      "level",
      "course",
      "style",
      "program",
      "section",
    )
  )
    return "batch";
  if (
    has(
      h,
      "joined",
      "joining",
      "join",
      "admission",
      "doj",
      "enrolled",
      "enrolment",
      "start",
      "since",
    )
  )
    return "joinedOn";
  if (has(h, "note", "notes", "remark", "remarks", "comment", "comments")) return "note";
  if (has(h, "name", "dancer", "student", "child", "kid", "participant", "member")) return "name";
  return null;
}

const looksPhone = (v: string) => normalizePhone(v) !== null;
const looksEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
const looksDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) ||
  /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(v) ||
  /^\d{1,2}[ -](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[ -,]*\d{2,4}$/i.test(v);
const looksAmount = (v: string) => {
  const n = Number(v.replace(/[₹,\s]|rs\.?|inr|\/-/gi, ""));
  return Number.isFinite(n) && n >= 100 && n <= 200_000;
};
const looksName = (v: string) => /^[\p{L}][\p{L}\s.'-]{1,60}$/u.test(v) && !/\d/.test(v);

const share = (values: string[], test: (v: string) => boolean) =>
  values.length === 0 ? 0 : values.filter(test).length / values.length;

/** What the cells themselves suggest, for columns whose heading did not say. */
function targetFromContent(values: string[]): { target: Target; reason: string } | null {
  if (values.length === 0) return null;
  if (share(values, looksEmail) >= 0.7)
    return { target: "email", reason: "These look like email addresses" };
  if (share(values, looksPhone) >= 0.7)
    return { target: "phone", reason: "These look like phone numbers" };
  if (share(values, looksDate) >= 0.7)
    return { target: "joinedOn", reason: "These look like dates" };
  if (share(values, looksAmount) >= 0.7)
    return { target: "fee", reason: "These look like rupee amounts" };
  const distinct = new Set(values.map((v) => v.toLowerCase())).size;
  if (
    values.length >= 4 &&
    distinct <= Math.max(2, Math.floor(values.length / 2)) &&
    share(values, (v) => v.length <= 30) === 1
  )
    return { target: "batch", reason: "The same few words repeat, like class names" };
  return null;
}

const cell = (v: unknown) =>
  v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim();

/** Turns a grid of cells (from Excel or CSV) into headings and rows, deciding whether the first row is headings. */
export function toSheet(grid: unknown[][]): Sheet {
  const rows = grid.map((row) => row.map(cell)).filter((row) => row.some((c) => c !== ""));
  if (rows.length === 0) return { headers: [], rows: [], hadHeader: false };
  const width = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => [...r, ...Array.from({ length: width - r.length }, () => "")]);
  const first = padded[0]!;
  const filled = first.filter((c) => c !== "");
  // A heading row is words. A first row full of phone numbers and amounts is a dancer.
  const hadHeader =
    filled.length > 0 &&
    share(filled, (c) => looksPhone(c) || looksAmount(c) || looksEmail(c)) < 0.5;
  if (hadHeader) return { headers: first, rows: padded.slice(1), hadHeader: true };
  return { headers: first.map((_, i) => ""), rows: padded, hadHeader: false };
}

const columnLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `Column ${i + 1}`);

/** Decide what every column is. Each single-value field (name, phone…) is given to the best column only once. */
export function guessColumns(sheet: Sheet): ColumnGuess[] {
  const guesses: ColumnGuess[] = sheet.headers.map((header, index) => {
    const values = sheet.rows.map((r) => r[index] ?? "").filter((v) => v !== "");
    const samples = [...new Set(values)].slice(0, 3);
    const label = header || `Column ${columnLetter(index)}`;
    const fromHeader = targetFromHeader(header);
    if (fromHeader)
      return {
        index,
        header: label,
        target: fromHeader,
        confidence: "sure",
        reason: `Heading says "${header}"`,
        samples,
      };
    const fromContent = targetFromContent(values);
    if (fromContent)
      return {
        index,
        header: label,
        target: fromContent.target,
        confidence: "guess",
        reason: fromContent.reason,
        samples,
      };
    return {
      index,
      header: label,
      target: "ignore",
      confidence: "unknown",
      reason: values.length === 0 ? "Empty column" : "Not sure what this is",
      samples,
    };
  });

  // No column called name? Take the first column that is mostly people's names.
  if (!guesses.some((g) => g.target === "name")) {
    const pick = guesses.find(
      (g) =>
        g.confidence === "unknown" &&
        share(sheet.rows.map((r) => r[g.index] ?? "").filter(Boolean), looksName) >= 0.7,
    );
    if (pick) {
      pick.target = "name";
      pick.confidence = "guess";
      pick.reason = "These look like people's names";
    }
  }

  // A second column claiming a single-value field loses it and is asked about instead.
  const single: Target[] = [
    "name",
    "phone",
    "fee",
    "parent",
    "email",
    "joinedOn",
    "emergencyName",
    "emergencyPhone",
  ];
  for (const target of single) {
    const claimed = guesses.filter((g) => g.target === target);
    claimed
      .sort(
        (a, b) =>
          Number(b.confidence === "sure") - Number(a.confidence === "sure") || a.index - b.index,
      )
      .slice(1)
      .forEach((g) => {
        g.target = "ignore";
        g.confidence = "unknown";
        g.reason = `Already using another column for ${TARGETS.find((t) => t.id === target)?.label.toLowerCase()}`;
      });
  }
  return guesses;
}

/** The columns the owner still has to look at: anything not clearly recognised that has something in it. */
export const needsAnswer = (guess: ColumnGuess) =>
  guess.confidence === "unknown" && guess.samples.length > 0;

const BATCH_SPLIT = /\s*(?:,|;|\/|&|\+|\band\b|\n)\s*/i;

export type ImportDancer = GridDancer & {
  batches: string[];
  parentName: string | null;
};

export type ImportPlan = {
  dancers: ImportDancer[];
  /** Rows with a problem, with the sheet's own row number (counting the heading as row 1). */
  problems: { sheetRow: number; name: string; problem: string }[];
  tooMany: boolean;
  batchNames: string[];
};

/** Applies the chosen mapping to every row and checks each dancer the same way the add-dancers table does. */
export function buildImport(sheet: Sheet, mapping: ColumnGuess[]): ImportPlan {
  const sources = (target: Target) =>
    mapping.filter((m) => m.target === target).map((m) => m.index);
  const first = (row: string[], target: Target) => {
    for (const i of sources(target)) if ((row[i] ?? "") !== "") return row[i]!;
    return "";
  };
  const noteColumns = mapping.filter((m) => m.target === "note");
  const usable = sheet.rows.slice(0, MAX_IMPORT_ROWS);
  const gridRows = usable.map((row) => {
    const out = emptyRow();
    out.name = first(row, "name");
    out.phone = first(row, "phone");
    out.fee = first(row, "fee");
    out.email = first(row, "email");
    out.joinedOn = first(row, "joinedOn");
    out.emergencyName = first(row, "emergencyName");
    out.emergencyPhone = first(row, "emergencyPhone");
    // A note column keeps its heading, so "Allergy: peanuts" still makes sense later.
    out.note = noteColumns
      .map((m) =>
        (row[m.index] ?? "") === ""
          ? ""
          : noteColumns.length > 1 || m.header
            ? `${m.header}: ${row[m.index]}`
            : row[m.index]!,
      )
      .filter(Boolean)
      .join("; ");
    return out;
  });
  const checked = checkGrid(gridRows);
  const dancers: ImportDancer[] = checked.map((d) => {
    const row = usable[d.index]!;
    const batches = [
      ...new Set(
        sources("batch")
          .flatMap((i) => (row[i] ?? "").split(BATCH_SPLIT))
          .map((b) => b.trim())
          .filter((b) => b !== ""),
      ),
    ];
    const longBatch = batches.find((b) => b.length > 60);
    const parent = first(row, "parent");
    return {
      ...d,
      batches: batches.slice(0, 5),
      parentName: parent === "" ? null : parent.slice(0, 120),
      problem: d.problem ?? (longBatch ? "A class name is too long" : null),
    };
  });
  return {
    dancers,
    problems: dancers
      .filter((d) => d.problem)
      .map((d) => ({
        sheetRow: d.index + (sheet.hadHeader ? 2 : 1),
        name: d.name,
        problem: d.problem!,
      })),
    tooMany: sheet.rows.length > MAX_IMPORT_ROWS,
    batchNames: [...new Set(dancers.filter((d) => !d.problem).flatMap((d) => d.batches))],
  };
}

export type Suggestion = { id: string; text: string };

/** What the sheet is missing that the studio will want, said plainly. Never blocks the import. */
export function recommendations(mapping: ColumnGuess[], plan: ImportPlan): Suggestion[] {
  const has = (t: Target) => mapping.some((m) => m.target === t);
  const out: Suggestion[] = [];
  const ok = plan.dancers.filter((d) => !d.problem);
  if (!has("phone") || ok.some((d) => d.phone === null))
    out.push({
      id: "phone",
      text: has("phone")
        ? `${ok.filter((d) => d.phone === null).length} dancers have no phone number, so you cannot remind them on WhatsApp until you add one.`
        : "There is no phone number column. Add one (the parent's WhatsApp number) so reminders can be sent.",
    });
  if (!has("fee") || ok.some((d) => d.feePaise === null))
    out.push({
      id: "fee",
      text: has("fee")
        ? `${ok.filter((d) => d.feePaise === null).length} dancers have no fee. You can give them one fee together in the next step, or set it later.`
        : "There is no fee column. Add each dancer's monthly fee, or set one fee for everyone in the next step.",
    });
  if (!has("batch"))
    out.push({
      id: "batch",
      text: "There is no class column. Add one so dancers are grouped into batches and attendance works.",
    });
  if (
    !has("parent") &&
    ok.some((d) =>
      /kid|child|under|junior|\b\d{1,2}\s*(y|yr|yrs|years)\b/i.test(d.batches.join(" ")),
    )
  )
    out.push({
      id: "parent",
      text: "Some dancers look like children. Add the parent's name so reminders are addressed to the parent.",
    });
  return out;
}

/** A small CSV reader: quotes, commas inside quotes, and either line ending. Semicolon files are read too. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
        ? "\t"
        : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** A date cell read by the Excel reader arrives as a Date; the rest are text or numbers. */
export function cellToText(value: unknown): string {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  return cell(value);
}

export { normalizeDate };
