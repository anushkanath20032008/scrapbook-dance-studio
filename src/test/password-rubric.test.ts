import { describe, expect, it } from "vitest";
import { checkPassword, explainAuthError, passwordMeetsRubric } from "@/lib/password-rubric";

describe("password rubric", () => {
  it("accepts a long mixed passphrase", () => {
    expect(passwordMeetsRubric("Maple-Tiger-Lamp-42", "a@b.com")).toBe(true);
  });
  it("rejects short, single-case, common and email-based passwords", () => {
    expect(passwordMeetsRubric("Ab1!", "a@b.com")).toBe(false);
    expect(passwordMeetsRubric("alllowercase123", "a@b.com")).toBe(false);
    expect(passwordMeetsRubric("Password12345", "a@b.com")).toBe(false);
    expect(passwordMeetsRubric("Anushka-Dance-2026", "anushka@x.com")).toBe(false);
  });
  it("reports each rule separately", () => {
    const unmet = checkPassword("abcdefghij", "a@b.com").filter((rule) => !rule.met);
    expect(unmet.map((rule) => rule.id)).toEqual(["case", "digit"]);
  });
  it("explains the backend weak-password refusal", () => {
    expect(explainAuthError("Password is known to be weak and easy to guess")).toMatch(/breaches/);
    expect(explainAuthError("Invalid login credentials")).toBe("Invalid login credentials");
  });
});
