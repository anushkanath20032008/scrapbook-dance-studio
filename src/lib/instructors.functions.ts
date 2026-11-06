import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSubscription } from "@/lib/access-middleware";
import { batchInput } from "@/lib/schemas";
import { isoDate, personName, phone, uuid, validate } from "@/lib/validators";

// Owner side: invite, list and remove instructors. The database refuses anyone who is not the studio owner.
export const inviteInstructor = createServerFn({ method: "POST" })
  .middleware([requireSubscription])
  .inputValidator(
    validate(
      z.object({
        email: z
          .string()
          .trim()
          .toLowerCase()
          .max(254)
          .email("Enter a valid email, or leave it empty to get a link")
          .or(z.literal(""))
          .transform((value) => (value === "" ? null : value)),
        days: z.union([z.literal(1), z.literal(7), z.literal(30)]),
      }),
    ),
  )
  .handler(async ({ data, context }) => {
    const baseUrl = process.env["PUBLIC_APP_URL"] || new URL(getRequest().url).origin;
    return (await import("@/lib/instructors.server")).inviteInstructor(context, data, baseUrl);
  });

export const listInstructors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    (await import("@/lib/instructors.server")).listInstructors(context),
  );

export const removeInstructor = createServerFn({ method: "POST" })
  .middleware([requireSubscription])
  .inputValidator(validate(z.object({ id: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/instructors.server")).removeInstructor(context, data),
  );

// Instructor side: accept an invite, then batches, dancer names and attendance. Each call goes through a
// database function that starts from the caller's own instructor row, so there is no studio id to tamper with.
export const acceptInstructorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ secret: z.string().trim().min(8).max(64) })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/instructors.server")).acceptInstructorInvite(context, data),
  );

export const getInstructorBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    (await import("@/lib/instructors.server")).getInstructorBatches(context),
  );

export const getInstructorRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ batchId: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/instructors.server")).getInstructorRoster(context, data),
  );

export const getInstructorBatchDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ batchId: uuid, date: isoDate })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/instructors.server")).getInstructorBatchDay(context, data),
  );

export const markInstructorAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(
      z.object({
        batchId: uuid,
        date: isoDate,
        marks: z
          .array(z.object({ studentId: uuid, present: z.boolean() }))
          .min(1, "Mark at least one dancer")
          .max(300)
          .refine(
            (list) => new Set(list.map((mark) => mark.studentId)).size === list.length,
            "A dancer is listed twice",
          ),
      }),
    ),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/instructors.server")).markInstructorAttendance(context, data),
  );

// What the account already is: the studio it teaches at, and whether it owns a studio. The console asks someone
// to join a studio only when it is neither, so an owner is never sent to the teacher screen.
export const getMyTeacherStudio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const server = await import("@/lib/instructors.server");
    const me = await server.getInstructorMe(context);
    const ownsStudio = await server.ownsStudio(context);
    return { studioName: me ? me.studio_name : null, ownsStudio };
  });

// Batch requests: a teacher suggests, the owner decides. Nothing is a real batch until the owner approves.
export const requestBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(batchInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/instructors.server")).requestBatch(context, {
      name: data.name,
      weekdays: data.weekdays,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      room: data.room,
    }),
  );

export const getMyBatchRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    (await import("@/lib/instructors.server")).getMyBatchRequests(context),
  );

export const listBatchRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    (await import("@/lib/instructors.server")).listBatchRequests(context),
  );

export const approveBatchRequest = createServerFn({ method: "POST" })
  .middleware([requireSubscription])
  .inputValidator(validate(z.object({ id: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/instructors.server")).approveBatchRequest(context, data),
  );

export const declineBatchRequest = createServerFn({ method: "POST" })
  .middleware([requireSubscription])
  .inputValidator(validate(z.object({ id: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/instructors.server")).declineBatchRequest(context, data),
  );

export const addInstructorStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ batchId: uuid, name: personName, phone: phone.nullable() })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/instructors.server")).addInstructorStudent(context, data),
  );

export const getInstructorStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    (await import("@/lib/instructors.server")).getInstructorStudents(context),
  );
