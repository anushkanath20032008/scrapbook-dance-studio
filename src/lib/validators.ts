import { z } from "zod";

// Input shapes shared by the server functions. Safe for the client bundle: no secrets, no server imports.

export const uuid = z.string().uuid();
export const personName = z.string().trim().min(1, "Enter a name").max(120);
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullish()
    .transform((value) => value ?? null);
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{10,18}$/, "Enter a valid phone number");

function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine(isRealDate, "That date does not exist");

/** Whole paise, positive, at most ₹10 crore. */
export const paise = z
  .number()
  .int("Amounts are whole paise")
  .positive("Enter an amount above zero")
  .max(1_000_000_000);

export const idempotencyKey = z.string().trim().min(8).max(100);
export const voidReason = z.string().trim().min(1, "Give a reason").max(500);

export const listLimit = z.number().int().min(1).max(200).default(100);
export const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the format HH:MM");

/** First day of the month containing the date, as YYYY-MM-DD. */
export function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Today's date in India as YYYY-MM-DD. */
export function todayInIndia(now: Date = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** Escape a user search term for use inside an ILIKE pattern. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** Adapter for createServerFn().inputValidator(): parse with a schema and keep the client-side input type. */
export const validate =
  <S extends z.ZodTypeAny>(schema: S) =>
  (input: z.input<S>): z.output<S> =>
    schema.parse(input);
