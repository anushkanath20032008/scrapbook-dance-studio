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
    const { error } = await context.supabase.from("studio_profiles").upsert({
      user_id: context.userId, name: data.name, studio_name: data.studioName,
      phone: data.phone || null, city: data.city,
    }, { onConflict: "user_id" });
    if (error) throw new Error("Could not save your studio details.");
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