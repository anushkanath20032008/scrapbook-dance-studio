import { formatRupees } from "@/lib/money";
import type { ZodError } from "zod";

export type FieldErrors = Record<string, string>;

/** First message per field, keyed by the field's name in the schema. */
export function fieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** What a dancer pays, as the dancer would read it: the amount and classes, never the studio's plan name. */
export const feeLabel = (plan: { amount_paise: number; classes_per_week: number | null }) =>
  `${formatRupees(plan.amount_paise)} a month${
    plan.classes_per_week
      ? ` · ${plan.classes_per_week} class${plan.classes_per_week === 1 ? "" : "es"} a week`
      : ""
  }`;
