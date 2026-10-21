import { createFileRoute } from "@tanstack/react-router";

// Telegram calls this with bot updates (a dancer joining, or tapping "I've paid"). Every request must carry the
// webhook secret header. The server code is imported inside the handler so the bot token and the service-role
// client never reach the browser bundle.
export const Route = createFileRoute("/api/webhooks/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        (await import("@/lib/telegram.server")).handleTelegramWebhookRequest(request),
    },
  },
});
