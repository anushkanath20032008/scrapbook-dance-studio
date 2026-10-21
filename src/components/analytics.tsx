import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

const CLARITY_PROJECT_ID = "z10kfunp0x";

// Pages that show nothing about a studio's dancers or payments. The console (/app), the account page, the owner
// pages, the private dancer link and the password and opt-out pages are left out on purpose, because Clarity
// records what is on screen, and those pages show names, phone numbers and amounts.
const PUBLIC_PATHS = new Set(["/", "/login", "/privacy", "/terms"]);

export function isAnalyticsPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname.replace(/\/+$/, "") || "/");
}

/** Microsoft Clarity (page recordings and heatmaps), loaded once, on the public pages only. */
export function Analytics() {
  const { pathname } = useLocation();

  useEffect(() => {
    const w = window as unknown as Record<string, unknown> & { clarity?: unknown };
    if (!isAnalyticsPath(pathname)) {
      // Moving from a public page into the console without a reload: stop recording and mask everything, in case
      // the tag is already running.
      document.body.setAttribute("data-clarity-mask", "True");
      if (typeof w.clarity === "function") (w.clarity as (...args: unknown[]) => void)("stop");
      return;
    }
    document.body.removeAttribute("data-clarity-mask");
    if (w["__clarityLoaded"]) return;
    w["__clarityLoaded"] = true;
    const clarity = function (...args: unknown[]) {
      const fn = clarity as unknown as { q?: unknown[] };
      (fn.q = fn.q ?? []).push(args);
    };
    w.clarity = w.clarity ?? clarity;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
    document.head.appendChild(script);
  }, [pathname]);

  return null;
}
