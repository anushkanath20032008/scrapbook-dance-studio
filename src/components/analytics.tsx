import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";

const CLARITY_PROJECT_ID = "z10kfunp0x";
const CONSENT_KEY = "choreo-analytics-consent";
const OPEN_EVENT = "choreo-consent-open";

// Pages that show nothing about a studio's dancers or payments. The console (/app), the account page, the owner
// pages, the private dancer link and the password and opt-out pages are left out on purpose, because Clarity
// records what is on screen, and those pages show names, phone numbers and amounts.
const PUBLIC_PATHS = new Set(["/", "/login", "/privacy", "/terms"]);

export function isAnalyticsPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname.replace(/\/+$/, "") || "/");
}

export type Consent = "yes" | "no" | null;
type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The visitor's saved choice about analytics, or null when they have not chosen yet. */
export function readConsent(store: Store | null = browserStore()): Consent {
  try {
    const value = store?.getItem(CONSENT_KEY);
    return value === "yes" || value === "no" ? value : null;
  } catch {
    return null;
  }
}

export function writeConsent(choice: "yes" | "no", store: Store | null = browserStore()) {
  try {
    store?.setItem(CONSENT_KEY, choice);
  } catch {
    // Storage is blocked: the choice applies to this visit only.
  }
}

/** Analytics runs only on a public page and only after the visitor said yes. */
export function shouldLoadAnalytics(pathname: string, consent: Consent): boolean {
  return consent === "yes" && isAnalyticsPath(pathname);
}

/** Opens the analytics choice again, for the "Cookie settings" link. */
export function openConsentChoice() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

type ClarityWindow = Record<string, unknown> & { clarity?: unknown };

/**
 * Microsoft Clarity (page recordings and heatmaps) on the public pages, only with the visitor's consent. Declining,
 * or changing their mind later, stops it. Inside the console it is stopped and the page is masked.
 */
export function Analytics() {
  const { pathname } = useLocation();
  const [consent, setConsent] = useState<Consent>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const saved = readConsent();
    setConsent(saved);
    setAsking(saved === null);
    const reopen = () => setAsking(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  useEffect(() => {
    const w = window as unknown as ClarityWindow;
    const call = (...args: unknown[]) => {
      if (typeof w.clarity === "function") (w.clarity as (...a: unknown[]) => void)(...args);
    };
    if (!isAnalyticsPath(pathname)) {
      // Moving from a public page into the console without a reload: stop recording and mask everything, in case
      // the tag is already running.
      document.body.setAttribute("data-clarity-mask", "True");
      call("stop");
      return;
    }
    document.body.removeAttribute("data-clarity-mask");
    if (consent !== "yes") {
      call("stop");
      return;
    }
    if (!shouldLoadAnalytics(pathname, consent)) return;
    if (w["__clarityLoaded"]) {
      call("start");
      return;
    }
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
  }, [pathname, consent]);

  function choose(choice: "yes" | "no") {
    writeConsent(choice);
    setConsent(choice);
    setAsking(false);
  }

  if (!asking || !isAnalyticsPath(pathname)) return null;
  return (
    <div className="consent-bar" role="dialog" aria-label="Analytics choice">
      <p>
        We use Microsoft Clarity to see where visitors click. It stays off unless you allow it.{" "}
        <a href="/privacy">Privacy</a>
      </p>
      <div className="consent-actions">
        <button type="button" className="consent-yes" onClick={() => choose("yes")}>
          Allow
        </button>
        <button type="button" className="consent-no" onClick={() => choose("no")}>
          No thanks
        </button>
      </div>
    </div>
  );
}
