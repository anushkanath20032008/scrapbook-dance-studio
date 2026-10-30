import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/** The visitor's country as the host reports it from the connection, or null when it is not reported. */
export function requestCountry(request: Request): string | null {
  const raw = request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry");
  const code = raw?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : null;
}

/** Used to show prices for the visitor's country. The charge itself is decided again on the server at checkout. */
export const getVisitorCountry = createServerFn({ method: "GET" }).handler(async () => ({
  country: requestCountry(getRequest()),
}));
