export type PasswordRule = { id: string; label: string; met: boolean };

const COMMON = ["password", "passw0rd", "12345678", "qwertyui", "iloveyou", "welcome1", "letmein1"];

/** The sign-up password rubric, shown live so the server's "weak password" refusal is rarely a surprise. */
export function checkPassword(password: string, email: string): PasswordRule[] {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const lower = password.toLowerCase();
  return [
    { id: "length", label: "At least 10 characters", met: password.length >= 10 },
    {
      id: "case",
      label: "An upper and a lower case letter",
      met: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { id: "digit", label: "A number or a symbol", met: /[\d\W_]/.test(password) },
    {
      id: "guessable",
      label: "Not your email or a common password",
      met:
        password.length > 0 &&
        !COMMON.some((word) => lower.includes(word)) &&
        !(local.length >= 4 && lower.includes(local)),
    },
  ];
}

export function passwordMeetsRubric(password: string, email: string): boolean {
  return checkPassword(password, email).every((rule) => rule.met);
}

export type AuthProblem = "wrong-login" | "unconfirmed" | "too-many-emails" | "weak-password" | "other";

/** What went wrong, from the backend message, so the screen can offer the right next step. */
export function authProblem(message: string): AuthProblem {
  if (/invalid login credentials|invalid credentials/i.test(message)) return "wrong-login";
  if (/not confirmed|confirm your email/i.test(message)) return "unconfirmed";
  if (/rate limit|too many|security purposes|after d+ seconds/i.test(message)) return "too-many-emails";
  if (/weak|pwned|leaked|easy to guess/i.test(message)) return "weak-password";
  return "other";
}

/** Turns the backend refusal into plain advice the owner can act on. */
export function explainAuthError(message: string): string {
  switch (authProblem(message)) {
    case "wrong-login":
      return "That email and password do not match. Check them and try again, or reset your password.";
    case "unconfirmed":
      return "This email is not confirmed yet. Open the link we emailed you, or send it again.";
    case "too-many-emails":
      return "Too many emails were sent to this address just now. Wait a few minutes and try again, or continue with Google.";
    case "weak-password":
      return "That password appears in known data breaches or is too easy to guess. Use a longer, unique passphrase, for example three or four unrelated words and a number.";
    default:
      return message;
  }
}

/**
 * Supabase answers a sign-up for an email that already has an account with a user that has no identities, and sends
 * no email. Without this check the owner is told to look for an email that never comes.
 */
export function isExistingAccount(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return Array.isArray(user?.identities) && user.identities.length === 0;
}
