import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} not found in :root`);
  return m[1] as string;
}

function lum(hex: string): number {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = ch;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a: string, b: string): number {
  const hi = Math.max(lum(a), lum(b));
  const lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
}

// Each public-page band: its background token, and the text colours drawn on it.
// body = 4.5:1, large = headings (3:1 is the floor; we hold them to body level where possible).
const bands: Array<{ band: string; selector: string; bg: string; body: string[]; large: string[] }> = [
  { band: "hero / features / video (paper)", selector: ".features", bg: "paper", body: ["ink", "blue"], large: ["ink", "blue"] },
  { band: "calculator (pink tint)", selector: ".calc-section", bg: "tint-pink", body: ["ink", "blue"], large: ["ink", "blue"] },
  { band: "problem (ink)", selector: ".problem", bg: "ink", body: ["paper", "marigold"], large: ["paper", "marigold"] },
  { band: "solution (pink)", selector: ".solution", bg: "grey", body: ["ink"], large: ["ink"] },
  { band: "pricing (gold tint)", selector: ".public-pricing", bg: "tint-gold", body: ["ink", "blue"], large: ["ink", "blue"] },
  { band: "faq (blue)", selector: ".faq", bg: "blue", body: ["paper"], large: ["paper", "marigold"] },
  { band: "final call to action (marigold)", selector: ".final-cta", bg: "marigold", body: ["ink", "blue"], large: ["ink"] },
  { band: "footer (ink)", selector: ".footer", bg: "ink", body: ["paper", "marigold"], large: ["paper", "marigold"] },
];

describe("public page contrast (AA)", () => {
  for (const b of bands) {
    it(`${b.band}: body text at 4.5:1 and headings at 3:1`, () => {
      for (const fg of b.body) expect(ratio(token(fg), token(b.bg)), `${fg} on ${b.bg}`).toBeGreaterThanOrEqual(4.5);
      for (const fg of b.large) expect(ratio(token(fg), token(b.bg)), `${fg} on ${b.bg}`).toBeGreaterThanOrEqual(3);
    });
    it(`${b.band}: the stylesheet paints ${b.selector} with var(--${b.bg})`, () => {
      const rule = css.split("\n").filter((l) => l.startsWith(`${b.selector} {`)).join(" ");
      if (b.bg !== "paper") expect(rule).toContain(`background:var(--${b.bg})`);
    });
  }

  it("a deliberately low-contrast fixture fails the ratio check", () => {
    expect(ratio("#777777", "#888888")).toBeLessThan(4.5);
    expect(ratio(token("ink"), token("paper"))).toBeGreaterThan(4.5);
  });

  it("neighbouring bands never share a background", () => {
    const order = ["tint-pink", "ink", "paper", "grey", "paper", "tint-gold", "blue", "marigold", "ink"];
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
  });
});
