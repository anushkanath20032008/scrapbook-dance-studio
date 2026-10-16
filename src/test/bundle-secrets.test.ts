// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Scans the browser files of a production build (`npm run build`) for names and code that must stay on the
// server. Without a build there is nothing to scan, so the check is skipped rather than passing silently.
const assets = join(process.cwd(), ".output", "public", "assets");
const built = existsSync(assets);

function browserFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? browserFiles(join(dir, entry.name))
      : /\.(js|mjs|css|html)$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );
}

describe.skipIf(!built)("client bundle", () => {
  const forbidden = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "RENDER_JOB_SECRET",
    "WHATSAPP_PROVIDER_TOKEN",
    "WHATSAPP_PROVIDER_URL",
    "DODO_PAYMENTS_API_KEY",
    "DODO_PAYMENTS_WEBHOOK_KEY",
    "DODO_PAYMENTS_STARTER_PRODUCT_ID",
    "apply_billing_event",
    "claim_due_reminders",
    "token_hash",
    "supabaseAdmin",
  ];

  it("contains no server-only variable names, service-role client or privileged database calls", () => {
    const files = browserFiles(assets);
    expect(files.length).toBeGreaterThan(0);
    const leaks = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return forbidden
        .filter((needle) => text.includes(needle))
        .map((needle) => `${file}: ${needle}`);
    });
    expect(leaks).toEqual([]);
  });
});
