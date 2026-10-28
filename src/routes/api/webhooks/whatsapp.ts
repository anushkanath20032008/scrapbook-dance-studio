import { createFileRoute } from "@tanstack/react-router";

// WhatsApp calls this with delivery updates (GET once to verify the URL). Every update must carry Meta's
// signature. The server code is imported inside the handlers so the secrets and the service-role client
// never reach the browser bundle.
export const Route = createFileRoute("/api/webhooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await import("@/lib/whatsapp-status.server")).handleWhatsAppVerification(request),
      POST: async ({ request }) =>
        (await import("@/lib/whatsapp-status.server")).handleWhatsAppStatusWebhook(request),
    },
  },
});
