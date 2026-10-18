import { createFileRoute } from "@tanstack/react-router";

// Called once a day by the same scheduler as the reminder job, with `Authorization: Bearer <RENDER_JOB_SECRET>`.
// The server code is imported inside the handler so it never reaches the browser bundle.
export const Route = createFileRoute("/api/jobs/owner-nudge")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        (await import("@/lib/owner-nudge.server")).handleOwnerNudgeJob(request),
    },
  },
});
