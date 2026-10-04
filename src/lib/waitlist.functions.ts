import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const text = z.string().trim().max(120);
const signupSchema = z.object({
  studioName: text.min(2),
  whatsappNumber: z.string().trim().regex(/^\+?[0-9\s-]{10,18}$/, "Enter a valid WhatsApp number"),
  studentBucket: z.enum(["10-25", "26-50", "51-100", "101-300"]),
  estimatedAmount: z.number().int().min(0).max(10000000),
  monthlyFee: z.number().int().min(500).max(6000),
  latePercent: z.number().int().min(5).max(50),
  consent: z.literal(true),
  source: z.string().trim().max(80),
  utmSource: text.nullable(), utmMedium: text.nullable(), utmCampaign: text.nullable(),
  utmContent: text.nullable(), utmTerm: text.nullable(),
});

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((input) => signupSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = (getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0] || "unknown").trim();
    const bytes = new TextEncoder().encode(ip);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const ipHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin.from("waitlist_signups")
      .select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", hourAgo);
    if (countError) throw new Error("Could not accept your request right now. Please try again.");
    if ((count ?? 0) >= 5) throw new Error("Too many requests. Please try again later.");
    const { data: row, error } = await supabaseAdmin.from("waitlist_signups").insert({
      studio_name: data.studioName, whatsapp_number: data.whatsappNumber,
      student_bucket: data.studentBucket, estimated_amount: data.estimatedAmount,
      monthly_fee: data.monthlyFee, late_percent: data.latePercent, consent: data.consent,
      source: data.source, utm_source: data.utmSource, utm_medium: data.utmMedium,
      utm_campaign: data.utmCampaign, utm_content: data.utmContent, utm_term: data.utmTerm,
      ip_hash: ipHash,
    }).select("opt_out_token").single();
    if (error || !row) throw new Error("Could not save your request. Please try again.");
    return { token: row.opt_out_token };
  });

export const optOutWaitlist = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("waitlist_signups")
      .update({ opted_out_at: new Date().toISOString() }).eq("opt_out_token", data.token);
    if (error) throw new Error("Could not update your preference. Please try again.");
    return { ok: true };
  });

export const getWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isOwner, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "owner" });
    if (roleError || !isOwner) throw new Error("You don't have access to this list.");
    const { data, error } = await context.supabase.from("waitlist_signups")
      .select("id, studio_name, whatsapp_number, student_bucket, estimated_amount, created_at, source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, opted_out_at")
      .order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error("You don't have access to this list.");
    return data;
  });

export const activateOwnerAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const bearer = getRequestHeader("authorization");
    const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : "";
    if (!token) throw new Error("This account cannot access the waitlist.");
    const { data: identity, error: identityError } = await context.supabase.auth.getUser(token);
    if (identityError || identity.user?.id !== context.userId || identity.user.email?.toLowerCase() !== "nath.anushka26@gmail.com" || !identity.user.email_confirmed_at) {
      throw new Error("This account cannot access the waitlist.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: context.userId, role: "owner" }, { onConflict: "user_id,role" });
    if (error) throw new Error("Could not activate owner access. Please try again.");
    return { ok: true };
  });