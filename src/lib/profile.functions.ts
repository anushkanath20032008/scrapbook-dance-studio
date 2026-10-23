import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  studioName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{10,18}$/).or(z.literal("")),
  city: z.string().trim().max(100),
});

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Create the row if this is the first save, then update only the columns an owner may change. A single
    // upsert also tries to rewrite user_id, which the database does not let an owner update.
    const created = await context.supabase
      .from("studio_profiles")
      .upsert({ user_id: context.userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { error } = created.error
      ? created
      : await context.supabase
          .from("studio_profiles")
          .update({
            name: data.name,
            studio_name: data.studioName,
            phone: data.phone || null,
            city: data.city,
          })
          .eq("user_id", context.userId);
    if (error) {
      console.error("[profile] save failed", error.code, error.message);
      throw new Error("Could not save your studio details.");
    }
    return { ok: true };
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("studio_profiles")
      .select("name, studio_name, phone, city, plan, billing_status")
      .eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("Could not load your studio details.");
    return data;
  });