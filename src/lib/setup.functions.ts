import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { listLimit, validate } from "@/lib/validators";

export const getSetupCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await import("@/lib/setup.server")).getSetupCounts(context));

export const listStudentOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(z.object({ includeArchived: z.boolean().default(false), limit: listLimit })),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/setup.server")).listStudentOverview(context, data),
  );
