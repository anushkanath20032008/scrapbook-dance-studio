// Remembers, in this browser only, that the person chose "I am a dance teacher" on the sign-in page, so the
// console asks them to join a studio before anything else instead of making a studio of their own.
const KEY = "choreo-intent";

export function getRoleIntent(): "teacher" | null {
  try {
    return window.localStorage.getItem(KEY) === "teacher" ? "teacher" : null;
  } catch {
    return null;
  }
}

export function setRoleIntent(role: "owner" | "teacher") {
  try {
    if (role === "teacher") window.localStorage.setItem(KEY, "teacher");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage can be blocked; the join page still works from an invite link.
  }
}
