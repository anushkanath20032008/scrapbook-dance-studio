import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isoDate, validate } from "@/lib/validators";

export const getHomeReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ period: isoDate })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/reports.server")).getHomeReport(context, data),
  );
