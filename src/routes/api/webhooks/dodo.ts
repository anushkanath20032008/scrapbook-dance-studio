import { createFileRoute } from "@tanstack/react-router";

// Dodo Payments calls this with signed subscription events. The server code is imported inside the handler
// so the webhook key and the service-role client never reach the browser bundle.
export const Route = createFileRoute("/api/webhooks/dodo")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        (await import("@/lib/dodo-webhook.server")).handleDodoWebhookRequest(request),
    },
  },
});
