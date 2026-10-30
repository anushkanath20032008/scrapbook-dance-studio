import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { cleanCountry } from "@/lib/pricing";

/** The visitor's country from the CDN, used only to quote prices in a familiar currency. Nothing is stored. */
export const getVisitorCountry = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequest().headers;
  const country = cleanCountry(headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry"));
  return { country };
});
