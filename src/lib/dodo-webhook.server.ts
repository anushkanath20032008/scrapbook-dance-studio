import DodoPayments from "dodopayments";
import type { Database } from "@/integrations/supabase/types";
import type { StudioPlanId } from "@/lib/plans";
import type { Db } from "./studio.server";

type Json = Database["public"]["Tables"]["billing_events"]["Insert"]["payload"];

/** What an event changes on the studio. A null status means the event carries no plan or status change. */
export type BillingDecision = {
  status: "active" | "past_due" | "on_hold" | "cancelled" | null;
  plan: StudioPlanId | "waitlist" | null;
  userId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  periodEnd: string | null;
  eventAt: string | null;
  note: Json;
};

export type ProductPlans = Record<string, StudioPlanId>;

/** Product ids come from server-only settings; the plan is always derived from the product, never from metadata. */
export function productPlansFromEnv(
  env: Record<string, string | undefined> = process.env,
): ProductPlans {
  const plans: ProductPlans = {};
  for (const [name, plan] of [
    ["DODO_PAYMENTS_STARTER_PRODUCT_ID", "starter"],
    ["DODO_PAYMENTS_GROWTH_PRODUCT_ID", "growth"],
    ["DODO_PAYMENTS_STUDIO_PRODUCT_ID", "studio"],
  ] as const) {
    const id = env[name]?.trim();
    if (id) plans[id] = plan;
  }
  // Per-band products (priced in dollars) grant the same plan as the main product.
  for (const band of ["A", "B", "C", "D"]) {
    for (const [name, plan] of [
      [`DODO_PAYMENTS_STARTER_PRODUCT_ID_${band}`, "starter"],
      [`DODO_PAYMENTS_STUDIO_PRODUCT_ID_${band}`, "studio"],
    ] as const) {
      const id = env[name]?.trim();
      if (id) plans[id] = plan;
    }
  }
  return plans;
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isoTime = (value: unknown) => {
  const parsed = typeof value === "string" ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;
};

/** Turn a verified event into the change it implies. Pure: no database, no clock. */
export function decideBillingUpdate(event: unknown, productPlans: ProductPlans): BillingDecision {
  const e = (event ?? {}) as {
    type?: unknown;
    timestamp?: unknown;
    data?: {
      subscription_id?: unknown;
      product_id?: unknown;
      metadata?: { user_id?: unknown };
      customer?: { customer_id?: unknown };
      next_billing_date?: unknown;
    };
  };
  const type = text(e.type) ?? "";
  const data = e.data ?? {};
  const userId = text(data.metadata?.user_id);
  const base: BillingDecision = {
    status: null,
    plan: null,
    userId: userId && uuidShape.test(userId) ? userId : null,
    subscriptionId: text(data.subscription_id),
    customerId: text(data.customer?.customer_id),
    periodEnd: isoTime(data.next_billing_date),
    eventAt: isoTime(e.timestamp),
    note: { type, product_id: text(data.product_id) },
  };

  const productPlan = productPlans[text(data.product_id) ?? ""];
  switch (type) {
    case "subscription.active":
    case "subscription.renewed":
    case "subscription.plan_changed":
    case "subscription.unpaused":
      // An unknown product cannot be mapped to a plan, so nothing is granted.
      return productPlan ? { ...base, status: "active", plan: productPlan } : base;
    case "subscription.on_hold":
      return { ...base, status: "on_hold" };
    case "subscription.past_due":
      return { ...base, status: "past_due" };
    case "subscription.cancelled":
      // Cancelled keeps the paid plan until the subscription expires.
      return { ...base, status: "cancelled" };
    case "subscription.expired":
      return { ...base, status: "cancelled", plan: "waitlist" };
    default:
      return base;
  }
}

type Deps = {
  admin: Db;
  key: string | undefined;
  productPlans: ProductPlans;
  verify?: (body: string, headers: Record<string, string>, key: string) => unknown;
};

function defaultVerify(body: string, headers: Record<string, string>, key: string) {
  const client = new DodoPayments({
    bearerToken: process.env["DODO_PAYMENTS_API_KEY"] || "webhook-only",
  });
  return client.webhooks.unwrap(body, { headers, key });
}

/**
 * Handle one Dodo delivery. The body is verified byte for byte before anything is parsed or stored. The
 * event is recorded as not applied, applied in one database step, and only then counted as done, so a
 * failed apply answers 5xx and Dodo delivers it again.
 */
export async function handleDodoWebhook(request: Request, deps: Deps): Promise<Response> {
  if (!deps.key) return new Response("Webhook is not configured", { status: 500 });

  const body = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    headers[name.toLowerCase()] = value;
  });
  const eventId = headers["webhook-id"];

  let event: unknown;
  try {
    if (!eventId) throw new Error("missing webhook-id");
    event = (deps.verify ?? defaultVerify)(body, headers, deps.key);
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  const decision = decideBillingUpdate(event, deps.productPlans);
  try {
    const recorded = await deps.admin.from("billing_events").upsert(
      {
        id: eventId,
        type: String((decision.note as { type?: unknown } | null)?.type ?? "unknown"),
        event_at: decision.eventAt,
        payload: decision.note,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (recorded.error) throw new Error("record failed");

    const { data, error } = await deps.admin.rpc("apply_billing_event", {
      p_event_id: eventId,
      p_user_id: decision.userId,
      p_status: decision.status,
      p_plan: decision.plan,
      p_subscription_id: decision.subscriptionId,
      p_customer_id: decision.customerId,
      p_event_at: decision.eventAt,
      p_period_end: decision.periodEnd,
    });
    if (error) throw new Error("apply failed");
    return Response.json({ received: true, outcome: data });
  } catch (err) {
    console.error(
      "[dodo-webhook] could not apply event",
      eventId,
      err instanceof Error ? err.message : err,
    );
    return new Response("Could not process event", { status: 500 });
  }
}

/** The production wiring used by the route. */
export async function handleDodoWebhookRequest(request: Request): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return handleDodoWebhook(request, {
    admin: supabaseAdmin,
    key: process.env["DODO_PAYMENTS_WEBHOOK_KEY"]?.trim() || undefined,
    productPlans: productPlansFromEnv(),
  });
}
