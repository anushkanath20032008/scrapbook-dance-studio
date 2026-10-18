import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Check the bearer secret on a background-job request (RENDER_JOB_SECRET), comparing digests in constant
 * time. Returns a Response to send when the request is not allowed, or null when it may proceed.
 */
export function authenticateJobRequest(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): Response | null {
  const secret = env["RENDER_JOB_SECRET"];
  if (!secret) return new Response("Server configuration error", { status: 500 });

  const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });

  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  if (!timingSafeEqual(digest(token), digest(secret)))
    return new Response("Unauthorized", { status: 401 });
  return null;
}
