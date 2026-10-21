import { useEffect } from "react";

/** Delay before an item in a row of siblings fades in, so a row arrives one after another. Capped so it never drags. */
export function revealDelay(indexAmongSiblings: number): number {
  return Math.min(Math.max(indexAmongSiblings, 0), 4) * 90;
}

/** An element is due once its top edge has come into view or been scrolled past, so a jump down the page, such as
 *  tapping a menu link, never leaves skipped sections hidden. */
export function isDue(top: number, viewportHeight: number): boolean {
  return top < viewportHeight * 0.92;
}

/**
 * Fades elements in as they scroll into view. The page is fully visible without JavaScript: the hidden starting
 * state is only added here, after the page has loaded, and not at all for people who ask for less motion.
 */
export function useScrollReveal(selector: string, skipInside = ".hero") {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (el) => !el.closest(skipInside),
    );
    const seen = new Map<Element, number>();
    for (const el of targets) {
      const parent = el.parentElement;
      const index = parent ? (seen.get(parent) ?? 0) : 0;
      if (parent) seen.set(parent, index + 1);
      el.style.setProperty("--reveal-delay", `${revealDelay(index)}ms`);
      el.classList.add("reveal");
    }

    let waiting = [...targets];
    let frame = 0;
    const check = () => {
      frame = 0;
      waiting = waiting.filter((el) => {
        if (!isDue(el.getBoundingClientRect().top, window.innerHeight)) return true;
        el.classList.add("reveal-in");
        return false;
      });
      if (waiting.length === 0) {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      for (const el of targets) el.classList.remove("reveal", "reveal-in");
    };
  }, [selector, skipInside]);
}
