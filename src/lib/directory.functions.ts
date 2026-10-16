import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { listLimit, personName, phone, uuid, validate } from "@/lib/validators";

const listInput = z.object({
  search: z.string().trim().max(100).optional(),
  includeArchived: z.boolean().default(false),
  limit: listLimit,
});
const idInput = z.object({ id: uuid, archived: z.boolean() });

export const listGuardians = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(listInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/directory.server")).listGuardians(context, data),
  );

export const saveGuardian = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(
      z.object({
        id: uuid.optional(),
        name: personName,
        phone: phone
          .or(z.literal(""))
          .nullish()
          .transform((value) => value || null),
        remindersOptedOut: z.boolean().default(false),
      }),
    ),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/directory.server")).saveGuardian(context, data),
  );

export const setGuardianArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(idInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/directory.server")).setGuardianArchived(context, data),
  );

export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(listInput.extend({ guardianId: uuid.optional() })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/directory.server")).listStudents(context, data),
  );

export const saveStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(
      z.object({
        id: uuid.optional(),
        name: personName,
        guardianId: uuid.nullish().transform((value) => value ?? null),
      }),
    ),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/directory.server")).saveStudent(context, data),
  );

export const setStudentArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(idInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/directory.server")).setStudentArchived(context, data),
  );
