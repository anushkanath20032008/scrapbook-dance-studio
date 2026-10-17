import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isoDate, uuid, validate } from "@/lib/validators";

const marks = z
  .array(z.object({ studentId: uuid, present: z.boolean() }))
  .min(1, "Mark at least one student")
  .max(300)
  .refine(
    (list) => new Set(list.map((mark) => mark.studentId)).size === list.length,
    "A student is listed twice",
  );

export const markAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ batchId: uuid, date: isoDate, marks })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/attendance.server")).markAttendance(context, data),
  );

export const getBatchDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ batchId: uuid, date: isoDate })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/attendance.server")).getBatchDay(context, data),
  );

export const getStudentAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ studentId: uuid, from: isoDate, to: isoDate })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/attendance.server")).getStudentAttendance(context, data),
  );

export const getAttendanceSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(
      z
        .object({ from: isoDate, to: isoDate })
        .refine((range) => range.to >= range.from, "The end date cannot be before the start date"),
    ),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/attendance-summary.server")).getAttendanceSummary(context, data),
  );
