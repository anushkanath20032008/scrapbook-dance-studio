import { useEffect } from "react";

/** Delay before an item in a row of siblings fades in, so a row arrives one after another. Capped so it never drags. */
export function revealDelay(indexAmongSiblings: number): number {
  return Math.min(Math.max(indexAmongSiblings, 0), 4) * 90;
}

/**
 * Fades elements in as they scroll into view. The page is fully visible without JavaScript: the hidden starting
 * state is only added here, after the page has loaded, and not at all for people who ask for less motion.
 */
export function useScrollReveal(selector: string, skipInside = ".hero") {
  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (el) => !el.closest(skipInside),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("reveal-in");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    const seen = new Map<Element, number>();
    for (const el of targets) {
      const parent = el.parentElement;
      const index = parent ? (seen.get(parent) ?? 0) : 0;
      if (parent) seen.set(parent, index + 1);
      el.style.setProperty("--reveal-delay", `${revealDelay(index)}ms`);
      el.classList.add("reveal");
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      for (const el of targets) el.classList.remove("reveal", "reveal-in");
    };
  }, [selector, skipInside]);
}
