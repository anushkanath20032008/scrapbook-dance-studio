import { z } from "zod";
import {
  clockTime,
  firstOfMonth,
  idempotencyKey,
  isoDate,
  optionalText,
  paise,
  personName,
  uuid,
} from "./validators";

// Input schemas that carry rules worth testing on their own. Client-safe: no server imports.

const weekdays = z
  .array(z.number().int().min(0).max(6))
  .max(7)
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

export const batchInput = z
  .object({
    id: uuid.optional(),
    name: personName,
    weekdays: weekdays.default([]),
    startsAt: clockTime.nullish().transform((value) => value ?? null),
    endsAt: clockTime.nullish().transform((value) => value ?? null),
    trainerName: optionalText(120),
    room: optionalText(120),
  })
  .refine((batch) => !batch.startsAt || !batch.endsAt || batch.endsAt > batch.startsAt, {
    message: "The class must end after it starts",
    path: ["endsAt"],
  });

export const feePlanInput = z.object({
  id: uuid.optional(),
  name: personName,
  amountPaise: paise,
  classesPerWeek: z
    .number()
    .int()
    .min(1)
    .max(14)
    .nullish()
    .transform((value) => value ?? null),
});

export const paymentMethods = ["cash", "upi", "bank", "other"] as const;

export const paymentInput = z.object({
  studentId: uuid,
  amountPaise: paise,
  method: z.enum(paymentMethods),
  paidOn: isoDate,
  note: optionalText(500),
  reference: optionalText(100),
  acknowledgeExcess: z.boolean().default(false),
  idempotencyKey,
});

export const generateChargesInput = z
  .object({ period: isoDate, dueOn: isoDate.optional() })
  .refine((input) => !input.dueOn || input.dueOn >= firstOfMonth(input.period), {
    message: "The due date cannot be before the month it bills",
    path: ["dueOn"],
  });

export const screenshotMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
export const SCREENSHOT_BUCKET = "claim-screenshots";
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

const claimShape = {
  studentId: uuid,
  amountPaise: paise,
  method: z.enum(paymentMethods),
  paidOn: isoDate,
  reference: optionalText(100),
  screenshotType: z.enum(screenshotMimeTypes).optional(),
};

/** UPI and bank payments need a reference number. */
const hasReference = (claim: { method: string; reference: string | null }) =>
  !(claim.method === "upi" || claim.method === "bank") || claim.reference !== null;
const referenceIssue = {
  message: "Enter the reference number for a UPI or bank payment",
  path: ["reference"],
};

/** What a dancer sends from their private link. */
export const claimInput = z
  .object({ token: z.string().min(1).max(200), ...claimShape })
  .refine(hasReference, referenceIssue);

/** What a signed-in dancer sends from their own account: the studio, never a guardian or a token. */
export const memberClaimInput = z
  .object({ studioId: uuid, ...claimShape })
  .refine(hasReference, referenceIssue);

/** A short code or a whole link, as typed by a dancer. */
export const joinInput = z.object({ secret: z.string().trim().min(1).max(200) });
