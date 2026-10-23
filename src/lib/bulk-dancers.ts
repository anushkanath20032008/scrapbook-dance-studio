// Turns a pasted list of dancers (from a notebook, a spreadsheet or WhatsApp contacts) into rows the owner can check
// before adding. Pure and forgiving: one dancer per line, phone and monthly fee optional, in any order.

import { parseRupees } from "./money";

export type ParsedDancer = {
  line: number;
  name: string;
  phone: string | null;
  /** A fee typed on this line, in paise. Null means "use the fee for everyone". */
  feePaise: number | null;
  /** Why this line cannot be added yet, in words the owner can act on. Null when it is fine. */
  problem: string | null;
};

export const MAX_PASTED_DANCERS = 200;
const MAX_FEE_RUPEES = 100_000;

// Digits in groups split by single spaces or dashes, with an optional + in front: "+91 98765 43210".
const DIGIT_GROUPS = /\+?\d+(?:[\s-]\d+)*/g;
const FEE_CELL = /^(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(?:\/-|rs\.?|rupees)?$/i;
// A comma splits cells unless it sits between digits (1,500).
const CELL_SPLIT = /\t|;|\||(?<!\d),|,(?!\d)/;

/**
 * The first phone-looking run in a line: groups of digits are taken until they make a full number (10 digits, or
 * 11 with a leading 0, or 12 with 91), so a fee typed right after the phone is not swallowed into it.
 */
function findPhone(text: string): { raw: string; start: number; end: number } | null {
  for (const match of text.matchAll(DIGIT_GROUPS)) {
    const origin = match.index ?? 0;
    let offset = 0;
    let end = 0;
    let digits = "";
    for (const group of match[0].split(/(?<=\d)(?=[\s-])|(?<=[\s-])(?=\d)/)) {
      if (/^[\s-]$/.test(group)) {
        offset += 1;
        continue;
      }
      const next = digits + group.replace(/\D/g, "");
      if (digits.length >= 10) break;
      digits = next;
      offset += group.length;
      end = offset;
    }
    if (digits.length >= 10) return { raw: match[0].slice(0, end), start: origin, end: origin + end };
  }
  return null;
}

/** A phone number as "+91 98765 43210" for Indian mobiles, "+<digits>" for others, or null if it cannot be one. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const national =
    digits.length === 10
      ? digits
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits.length === 12 && digits.startsWith("91")
          ? digits.slice(2)
          : null;
  if (national !== null) {
    if (!/^[6-9]/.test(national)) return null;
    return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  if (digits.length >= 11 && digits.length <= 15 && raw.trim().startsWith("+")) return `+${digits}`;
  return null;
}

function cleanName(text: string): string {
  return text
    .replace(/^\s*\d{1,3}\s*[.)]\s+/, "")
    .replace(/^[\s\-–—:•*]+|[\s\-–—:•*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLine(raw: string, line: number): ParsedDancer | null {
  const text = raw.trim();
  if (text === "") return null;
  let problem: string | null = null;
  let phone: string | null = null;
  let rest = text;

  const run = findPhone(text);
  if (run) {
    phone = normalizePhone(run.raw);
    if (phone === null) problem = "That phone number does not look right";
    rest = `${text.slice(0, run.start)}\t${text.slice(run.end)}`;
  }

  let feePaise: number | null = null;
  const names: string[] = [];
  for (const cell of rest.split(CELL_SPLIT)) {
    const piece = cell.trim();
    if (piece === "") continue;
    const fee = FEE_CELL.exec(piece);
    if (fee && fee[1]) {
      const digits = fee[1].replace(/\D/g, "");
      if (digits.length >= 7) {
        problem ??= "That phone number does not look right";
        continue;
      }
      const paise = parseRupees(fee[1]);
      if (paise === null || paise <= 0 || paise > MAX_FEE_RUPEES * 100)
        problem ??= "That fee does not look right";
      else if (feePaise === null) feePaise = paise;
      continue;
    }
    // "Asha Rao 1500": a fee at the end of a name with nothing between them.
    const trailing = /^(.*\S)\s+(?:₹|rs\.?\s*)?(\d{3,6}(?:\.\d{1,2})?)$/i.exec(piece);
    if (trailing && trailing[1] && trailing[2] && feePaise === null) {
      const paise = parseRupees(trailing[2]);
      const spoken = cleanName(trailing[1]);
      if (paise !== null && paise > 0 && paise <= MAX_FEE_RUPEES * 100) feePaise = paise;
      else problem ??= "That fee does not look right";
      if (spoken !== "") names.push(spoken);
      continue;
    }
    const name = cleanName(piece);
    if (name !== "") names.push(name);
  }

  const name = names.join(" ").slice(0, 120);
  if (/\d{7,}/.test(name.replace(/[\s-]/g, ""))) problem ??= "That phone number does not look right";
  if (name === "") problem ??= "No name on this line";
  return { line, name, phone, feePaise, problem };
}

/** Parse the whole paste. A second identical dancer (same name and phone) is flagged so it is not added twice. */
export function parseDancerList(text: string): ParsedDancer[] {
  const seen = new Set<string>();
  const rows: ParsedDancer[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const row = parseLine(raw, index + 1);
    if (!row) return;
    if (!row.problem) {
      const key = `${row.name.toLowerCase()}|${row.phone ?? ""}`;
      if (seen.has(key)) row.problem = "Already on the list above";
      seen.add(key);
    }
    rows.push(row);
  });
  return rows;
}

/** The rows that can be added as they are. */
export const addableDancers = (rows: ParsedDancer[]) => rows.filter((row) => row.problem === null);

/** A sensible fee to start from: the amount most dancers already pay, otherwise a round figure to edit. */
export function suggestFeeRupees(existingAmountsPaise: number[]): string {
  if (existingAmountsPaise.length === 0) return "1500";
  const tally = new Map<number, number>();
  for (const amount of existingAmountsPaise) tally.set(amount, (tally.get(amount) ?? 0) + 1);
  const [best] = [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] ?? [150000];
  return String(best / 100);
}
