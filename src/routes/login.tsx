import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { PasswordField } from "@/components/password-field";
import { useOwnerSession } from "@/hooks/use-owner";
import { supabase } from "@/integrations/supabase/client";
import {
  authProblem,
  checkPassword,
  explainAuthError,
  isExistingAccount,
  passwordMeetsRubric,
} from "@/lib/password-rubric";

export const Route = createFileRoute("/login")({
  // Read on the server too, so the page opens on Register at once and never flashes Sign in first.
  validateSearch: (search: Record<string, unknown>): { mode?: "register" | "forgot" } =>
    search["mode"] === "register" || search["mode"] === "forgot" ? { mode: search["mode"] } : {},
  head: () => ({
    meta: [
      { title: "Sign in | ChoreoStudio" },
      { name: "description", content: "Sign in or create your ChoreoStudio account." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Login,
});

type Mode = "sign-in" | "register" | "forgot";

const headings: Record<Mode, string> = {
  "sign-in": "Welcome back.",
  register: "Start your studio.",
  forgot: "Reset password.",
};

function Login() {
  const navigate = useNavigate();
  const session = useOwnerSession();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.mode ?? "sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // A pop-up the person cannot miss after we send an email, with a way to send it again.
  const [sentTo, setSentTo] = useState<{ email: string; kind: "confirm" | "reset" } | null>(null);
  const [resendNote, setResendNote] = useState("");
  const [error, setError] = useState("");
  // What the person can do about the error: sign-in problems point at a reset, an unconfirmed email at a resend.
  const [fix, setFix] = useState<"reset" | "resend" | "existing" | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Someone who is already signed in goes straight to the console.
  useEffect(() => {
    if (session.status === "signed-in") void navigate({ to: "/app" });
  }, [session.status, navigate]);

  useEffect(() => {
    setError("");
    setFix(null);
    emailRef.current?.focus();
  }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFix(null);
    const address = email.trim();
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSentTo({ email: address, kind: "reset" });
        setResendNote("");
      } else if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        if (isExistingAccount(data.user)) {
          setError("There is already an account with this email.");
          setFix("existing");
        } else if (data.session) {
          void navigate({ to: "/app" });
        } else {
          setSentTo({ email: address, kind: "confirm" });
          setResendNote("");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(message ? explainAuthError(message) : "Something went wrong. Please try again.");
      const problem = authProblem(message);
      if (problem === "wrong-login") setFix("reset");
      if (problem === "unconfirmed") setFix("resend");
    } finally {
      setBusy(false);
    }
  }

  async function sendAgain() {
    if (!sentTo) return;
    setResendNote("Sending...");
    const { error: resendError } =
      sentTo.kind === "confirm"
        ? await supabase.auth.resend({
            type: "signup",
            email: sentTo.email,
            options: { emailRedirectTo: `${window.location.origin}/app` },
          })
        : await supabase.auth.resetPasswordForEmail(sentTo.email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });
    setResendNote(
      resendError
        ? explainAuthError(resendError.message)
        : "Sent again. It can take a minute to arrive.",
    );
  }

  async function resendFromSignIn() {
    const address = email.trim();
    setBusy(true);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setBusy(false);
    if (resendError) return setError(explainAuthError(resendError.message));
    setFix(null);
    setError("");
    setSentTo({ email: address, kind: "confirm" });
    setResendNote("");
  }

  async function continueWithGoogle() {
    setBusy(true);
    setError("");
    setFix(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/app`,
        // Always let the person choose which Google account to use.
        queryParams: { prompt: "select_account" },
      },
    });
    if (oauthError)
      setError("Google sign-in did not start. Use your email and password, or try again.");
    setBusy(false);
  }

  const registering = mode === "register";
  const rubricMet = passwordMeetsRubric(password, email);

  return (
    <main className="section login-page">
      <div className="wrap login-wrap">
        <a href="/">← ChoreoStudio</a>
        <h1 className="display login-title">{headings[mode]}</h1>
        <div className="window">
          <div className="window-bar chrome-font">
            {registering ? "Register.dialog" : "Sign-in.dialog"}
          </div>
          <div className="window-inner">
            {mode !== "forgot" && (
              <div className="login-tabs" role="tablist" aria-label="Sign in or register">
                <Button
                  type="button"
                  role="tab"
                  aria-selected={mode === "sign-in"}
                  variant={mode === "sign-in" ? "retro" : "retroPaper"}
                  onClick={() => setMode("sign-in")}
                >
                  Sign in
                </Button>
                <Button
                  type="button"
                  role="tab"
                  aria-selected={registering}
                  variant={registering ? "retro" : "retroPaper"}
                  onClick={() => setMode("register")}
                >
                  Register
                </Button>
              </div>
            )}
            {registering && (
              <p className="console-hint login-lede">
                Free for your first month. No card needed.
              </p>
            )}
            {mode === "forgot" && (
              <p className="console-hint login-lede">
                Enter your email and we will send a link to choose a new password.
              </p>
            )}
            <form onSubmit={submit}>
              <label className="form-label">
                Email
                <input
                  ref={emailRef}
                  className="field"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={255}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoFocus
                  aria-invalid={error !== "" && mode === "forgot"}
                />
              </label>
              {mode !== "forgot" && (
                <label className="form-label login-field">
                  Password
                  <PasswordField
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                      setFix(null);
                    }}
                    aria-invalid={error !== ""}
                    required
                    autoComplete={registering ? "new-password" : "current-password"}
                  />
                </label>
              )}
              {registering && (
                <ul className="login-rubric" aria-label="Password requirements">
                  {checkPassword(password, email).map((rule) => (
                    <li key={rule.id} data-met={rule.met}>
                      {rule.met ? "✓" : "○"} {rule.label}
                    </li>
                  ))}
                </ul>
              )}
              {error !== "" && (
                <p role="alert" className="login-error">
                  {error}
                </p>
              )}
              {fix === "reset" && (
                <p className="login-fix">
                  <button type="button" className="text-link" onClick={() => setMode("forgot")}>
                    Reset your password
                  </button>
                </p>
              )}
              {fix === "resend" && (
                <p className="login-fix">
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => void resendFromSignIn()}
                    disabled={busy}
                  >
                    Send the confirmation email again
                  </button>
                </p>
              )}
              {fix === "existing" && (
                <p className="login-fix">
                  <button type="button" className="text-link" onClick={() => setMode("sign-in")}>
                    Sign in instead
                  </button>
                  {" · "}
                  <button type="button" className="text-link" onClick={() => setMode("forgot")}>
                    Forgot your password?
                  </button>
                </p>
              )}
              <div className="login-actions">
                <Button variant="retro" type="submit" disabled={busy || (registering && !rubricMet)}>
                  {busy
                    ? "One moment…"
                    : mode === "forgot"
                      ? "Send reset link"
                      : registering
                        ? "Create account"
                        : "Sign in"}
                </Button>
              </div>
            </form>
            {mode !== "forgot" && (
              <>
                <p className="login-or">or</p>
                <div className="login-actions login-actions-tight">
                  <Button
                    variant="retroPaper"
                    type="button"
                    onClick={continueWithGoogle}
                    disabled={busy}
                  >
                    Continue with Google
                  </Button>
                </div>
              </>
            )}
            <p className="login-links">
              {mode === "forgot" ? (
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setMode("sign-in");
                  }}
                >
                  Back to sign in
                </a>
              ) : mode === "sign-in" ? (
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setMode("forgot");
                  }}
                >
                  Forgot password?
                </a>
              ) : null}
            </p>
          </div>
        </div>
      </div>
      <ConsoleDialog
        open={sentTo !== null}
        onOpenChange={(open) => {
          if (!open) setSentTo(null);
        }}
        title="Check your email"
      >
        {sentTo && (
          <div role="alert" className="email-sent">
            <p className="email-sent-big">
              {sentTo.kind === "confirm" ? "One more step." : "Reset link sent."}
            </p>
            <p>
              We emailed a {sentTo.kind === "confirm" ? "confirmation link" : "password reset link"} to{" "}
              <strong>{sentTo.email}</strong>.{" "}
              {sentTo.kind === "confirm"
                ? "Open it on this device and you will land in your studio."
                : "Open it to choose a new password."}
            </p>
            <p className="console-hint">
              It can take a few minutes. Check spam or promotions too. Nothing yet? Send it again,
              try Continue with Google, or write to support@choreostudio.live and we will sort it
              out.
            </p>
            {resendNote && <p role="status">{resendNote}</p>}
            <div className="console-form-actions">
              <Button variant="retro" type="button" onClick={() => setSentTo(null)}>
                OK, got it
              </Button>
              <Button variant="retroPaper" type="button" onClick={sendAgain}>
                Send it again
              </Button>
            </div>
          </div>
        )}
      </ConsoleDialog>
    </main>
  );
}
