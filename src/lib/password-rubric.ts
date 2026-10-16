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

/** Turns the backend's leaked or weak password refusal into advice the owner can act on. */
export function explainAuthError(message: string): string {
  return /weak|pwned|leaked|easy to guess/i.test(message)
    ? "That password appears in known data breaches or is too easy to guess. Use a longer, unique passphrase, for example three or four unrelated words and a number."
    : message;
}
