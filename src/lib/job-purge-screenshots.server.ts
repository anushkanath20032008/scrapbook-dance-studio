import { purgeScreenshots } from "./claims.server";
import { authenticateJobRequest } from "./job-auth.server";

/** Called on a schedule with the same bearer secret as the reminder job. Deletes screenshots that should no longer exist. */
export async function handlePurgeJob(request: Request): Promise<Response> {
  const denied = authenticateJobRequest(request);
  if (denied) return denied;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    return Response.json({ status: "ok", ...(await purgeScreenshots(supabaseAdmin)) });
  } catch {
    return Response.json({ status: "error" }, { status: 500 });
  }
}
