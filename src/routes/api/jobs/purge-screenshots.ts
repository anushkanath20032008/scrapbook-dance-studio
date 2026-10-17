import { createFileRoute } from "@tanstack/react-router";

// Called on a schedule (for example the same Render cron service) with `Authorization: Bearer <RENDER_JOB_SECRET>`.
// The server code is imported inside the handler so it never reaches the browser bundle.
export const Route = createFileRoute("/api/jobs/purge-screenshots")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        (await import("@/lib/job-purge-screenshots.server")).handlePurgeJob(request),
    },
  },
});
