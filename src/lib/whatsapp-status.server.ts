import { createHmac, timingSafeEqual } from "node:crypto";

// Delivery updates from the WhatsApp Cloud API. Meta calls this URL with a signed body every time a message
// we sent is delivered, read or fails. The app secret and verify token live in the host's environment.

export type DeliveryUpdate = {
  messageId: string;
  status: "delivered" | "read" | "failed";
  error: string | null;
};

/** True when the X-Hub-Signature-256 header matches the body, compared in constant time. */
export function signatureMatches(rawBody: string, header: string | null, secret: string): boolean {
  const match = /^sha256=([0-9a-f]{64})$/i.exec(header ?? "");
  if (!match?.[1]) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const given = Buffer.from(match[1], "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The delivered, read and failed updates in a webhook body. Anything else in the body is ignored. */
export function parseDeliveryUpdates(body: unknown): DeliveryUpdate[] {
  const updates: DeliveryUpdate[] = [];
  const entries = (body as { entry?: unknown } | null)?.entry;
  if (!Array.isArray(entries)) return updates;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown } | null)?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const statuses = (change as { value?: { statuses?: unknown } } | null)?.value?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const item of statuses) {
        const { id, status, errors } = (item ?? {}) as {
          id?: unknown;
          status?: unknown;
          errors?: unknown;
        };
        if (typeof id !== "string" || id === "") continue;
        if (status !== "delivered" && status !== "read" && status !== "failed") continue;
        const first = Array.isArray(errors)
          ? (errors[0] as { title?: unknown; message?: unknown } | undefined)
          : undefined;
        const reason =
          typeof first?.title === "string"
            ? first.title
            : typeof first?.message === "string"
              ? first.message
              : null;
        updates.push({ messageId: id, status, error: reason ? reason.slice(0, 300) : null });
      }
    }
  }
  return updates;
}

/** Meta's one-time check when the webhook URL is saved: echo the challenge if the verify token matches. */
export function handleWhatsAppVerification(
  request: Request,
  token = process.env["WHATSAPP_VERIFY_TOKEN"],
): Response {
  if (!token) return new Response("Not configured", { status: 503 });
  const url = new URL(request.url);
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === token
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function handleWhatsAppStatusWebhook(
  request: Request,
  secret = process.env["WHATSAPP_APP_SECRET"],
  record?: (update: DeliveryUpdate) => Promise<void>,
): Promise<Response> {
  if (!secret) return new Response("Not configured", { status: 503 });
  const raw = await request.text();
  if (raw.length > 1_000_000) return new Response("Too large", { status: 413 });
  if (!signatureMatches(raw, request.headers.get("x-hub-signature-256"), secret))
    return new Response("Unauthorized", { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const write =
    record ??
    (async (update: DeliveryUpdate) => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.rpc("record_delivery_status", {
        p_message_id: update.messageId,
        p_status: update.status,
        ...(update.error ? { p_error: update.error } : {}),
      });
      if (error) throw new Error("Could not record a delivery update.");
    });
  for (const update of parseDeliveryUpdates(body)) await write(update);
  return new Response("ok", { status: 200 });
}
