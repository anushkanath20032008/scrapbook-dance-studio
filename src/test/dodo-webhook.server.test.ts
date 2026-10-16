import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decideBillingUpdate,
  handleDodoWebhook,
  productPlansFromEnv,
} from "@/lib/dodo-webhook.server";
import { fakeSupabase } from "./fake-supabase";

const secret = randomBytes(24);
const key = `whsec_${secret.toString("base64")}`;
const userId = "11111111-1111-4111-8111-111111111111";
const productPlans = productPlansFromEnv({
  DODO_PAYMENTS_STARTER_PRODUCT_ID: "pdt_starter",
  DODO_PAYMENTS_GROWTH_PRODUCT_ID: "pdt_growth",
  DODO_PAYMENTS_STUDIO_PRODUCT_ID: "pdt_studio",
});

const event = (
  type: string,
  over: Record<string, unknown> = {},
  data: Record<string, unknown> = {},
) => ({
  business_id: "bus_1",
  type,
  timestamp: "2026-10-16T10:00:00Z",
  data: {
    subscription_id: "sub_A",
    product_id: "pdt_growth",
    customer: { customer_id: "cus_1", email: "owner@example.com" },
    metadata: { user_id: userId, plan: "studio" },
    next_billing_date: "2026-11-16T10:00:00Z",
    ...data,
  },
  ...over,
});

/** Sign a body the way Dodo does (Standard Webhooks: HMAC-SHA256 over "id.timestamp.body"). */
function signed(body: string, id = "evt_1") {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return {
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  };
}
const post = (body: string, headers: Record<string, string>) =>
  new Request("https://app.test/api/webhooks/dodo", { method: "POST", body, headers });

function setup(outcome: unknown = "applied", rpcError = false) {
  const { client, calls } = fakeSupabase((call) =>
    call.fn ? (rpcError ? { error: { code: "XX000", message: "boom" } } : { data: outcome }) : {},
  );
  const run = (request: Request, withKey: string | null = key) =>
    handleDodoWebhook(request, { admin: client, key: withKey ?? undefined, productPlans });
  return { run, calls };
}

describe("decideBillingUpdate", () => {
  it("takes the plan from the product, not from metadata", () => {
    const decision = decideBillingUpdate(
      event(
        "subscription.active",
        {},
        { product_id: "pdt_starter", metadata: { user_id: userId, plan: "studio" } },
      ),
      productPlans,
    );
    expect(decision).toMatchObject({
      status: "active",
      plan: "starter",
      userId,
      subscriptionId: "sub_A",
    });
  });

  it("maps each event type to the status it implies", () => {
    const status = (type: string) => decideBillingUpdate(event(type), productPlans);
    expect(status("subscription.renewed")).toMatchObject({ status: "active", plan: "growth" });
    expect(status("subscription.plan_changed")).toMatchObject({ status: "active", plan: "growth" });
    expect(status("subscription.on_hold")).toMatchObject({ status: "on_hold", plan: null });
    expect(status("subscription.past_due")).toMatchObject({ status: "past_due", plan: null });
    expect(status("subscription.cancelled")).toMatchObject({ status: "cancelled", plan: null });
    expect(status("subscription.expired")).toMatchObject({ status: "cancelled", plan: "waitlist" });
  });

  it("changes nothing for unrelated events, unknown products and missing or malformed owners", () => {
    expect(decideBillingUpdate(event("payment.succeeded"), productPlans).status).toBeNull();
    expect(
      decideBillingUpdate(
        event("subscription.active", {}, { product_id: "pdt_unknown" }),
        productPlans,
      ).status,
    ).toBeNull();
    expect(
      decideBillingUpdate(event("subscription.active", {}, { metadata: {} }), productPlans).userId,
    ).toBeNull();
    expect(
      decideBillingUpdate(
        event("subscription.active", {}, { metadata: { user_id: "not-a-uuid" } }),
        productPlans,
      ).userId,
    ).toBeNull();
    expect(decideBillingUpdate(null, productPlans).status).toBeNull();
  });

  it("keeps no personal details in the stored note", () => {
    const { note } = decideBillingUpdate(event("subscription.active"), productPlans);
    expect(JSON.stringify(note)).not.toContain("owner@example.com");
  });
});

describe("handleDodoWebhook", () => {
  it("applies a correctly signed subscription.active for the growth product", async () => {
    const { run, calls } = setup();
    const body = JSON.stringify(event("subscription.active"));
    const response = await run(post(body, signed(body)));
    expect(response.status).toBe(200);
    expect(calls.map((call) => call.table ?? call.fn)).toEqual([
      "billing_events",
      "apply_billing_event",
    ]);
    expect(calls[1]?.args).toEqual([
      {
        p_event_id: "evt_1",
        p_user_id: userId,
        p_status: "active",
        p_plan: "growth",
        p_subscription_id: "sub_A",
        p_customer_id: "cus_1",
        p_event_at: "2026-10-16T10:00:00.000Z",
        p_period_end: "2026-11-16T10:00:00.000Z",
      },
    ]);
  });

  it("rejects missing, wrong and tampered signatures without touching the database", async () => {
    const body = JSON.stringify(event("subscription.active"));
    const good = signed(body);
    const cases = [
      post(body, { "webhook-id": "evt_1" }),
      post(body, { ...good, "webhook-signature": "v1,AAAA" }),
      post(body.replace("growth", "studio"), good),
      post(body, { ...good, "webhook-id": "" }),
    ];
    for (const request of cases) {
      const { run, calls } = setup();
      expect((await run(request)).status).toBe(401);
      expect(calls).toHaveLength(0);
    }
  });

  it("rejects a body signed with a different key", async () => {
    const { run, calls } = setup();
    const body = JSON.stringify(event("subscription.active"));
    const other = `whsec_${randomBytes(24).toString("base64")}`;
    expect((await run(post(body, signed(body)), other)).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("answers 500 and does nothing when the webhook key is not configured", async () => {
    const { run, calls } = setup();
    const body = JSON.stringify(event("subscription.active"));
    expect((await run(post(body, signed(body)), null)).status).toBe(500);
    expect(calls).toHaveLength(0);
  });

  it("answers 5xx when the apply fails so the provider delivers the event again", async () => {
    const failing = setup("applied", true);
    const body = JSON.stringify(event("subscription.active"));
    expect((await failing.run(post(body, signed(body)))).status).toBe(500);
    const retry = setup("applied");
    expect((await retry.run(post(body, signed(body)))).status).toBe(200);
  });

  it("answers 200 for a redelivered event the database reports as already applied", async () => {
    const { run } = setup("duplicate");
    const body = JSON.stringify(event("subscription.active"));
    const response = await run(post(body, signed(body)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, outcome: "duplicate" });
  });

  it("records an event with no usable plan or owner and changes no studio", async () => {
    const { run, calls } = setup("ignored");
    const body = JSON.stringify(
      event("subscription.active", {}, { product_id: "pdt_unknown", metadata: {} }),
    );
    expect((await run(post(body, signed(body)))).status).toBe(200);
    expect(calls[1]?.args?.[0]).toMatchObject({ p_status: null, p_user_id: null });
  });
});
