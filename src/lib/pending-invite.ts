// The invite a dancer is in the middle of redeeming. Kept in localStorage (not sessionStorage) because an email
// magic link opens in a new tab, which would lose it. It is cleared as soon as it is redeemed or fails, expires
// after a day, and never goes back into a URL. Storage can be blocked, so every access is guarded.

const KEY = "choreo-pending-invite";
const MAX_AGE_MS = 24 * 3600_000;

export function savePendingInvite(secret: string, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ secret, savedAt: now }));
  } catch {
    // Without storage the dancer simply enters the code again after signing in.
  }
}

export function readPendingInvite(now: number = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { secret?: unknown; savedAt?: unknown };
    if (
      typeof parsed.secret !== "string" ||
      typeof parsed.savedAt !== "number" ||
      now - parsed.savedAt > MAX_AGE_MS
    ) {
      clearPendingInvite();
      return null;
    }
    return parsed.secret;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
