import { createFileRoute } from "@tanstack/react-router";

// Called on a schedule (for example a Render cron job) with `Authorization: Bearer <RENDER_JOB_SECRET>`.
// The server code is imported inside the handler so it never reaches the browser bundle.
export const Route = createFileRoute("/api/jobs/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        (await import("@/lib/reminder-job.server")).handleReminderJob(request),
    },
  },
});
