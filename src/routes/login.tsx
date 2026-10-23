import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { useOwnerSession } from "@/hooks/use-owner";
import { supabase } from "@/integrations/supabase/client";
import { checkPassword, explainAuthError, passwordMeetsRubric } from "@/lib/password-rubric";

export const Route = createFileRoute("/login")({
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
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  // A pop-up the person cannot miss after we send an email, with a way to send it again.
  const [sentTo, setSentTo] = useState<{ email: string; kind: "confirm" | "reset" } | null>(null);
  const [resendNote, setResendNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Someone who is already signed in goes straight to the console.
  useEffect(() => {
    if (session.status === "signed-in") void navigate({ to: "/app" });
  }, [session.status, navigate]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "register") setMode("register");
  }, []);

  useEffect(() => {
    setError("");
    setMessage("");
  }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSentTo({ email, kind: "reset" });
        setResendNote("");
      } else if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        setSentTo({ email, kind: "confirm" });
        setResendNote("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? explainAuthError(caught.message)
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendAgain() {
    if (!sentTo) return;
    setResendNote("Sending...");
    const { error: resendError } =
      sentTo.kind === "confirm"
        ? await supabase.auth.resend({ type: "signup", email: sentTo.email })
        : await supabase.auth.resetPasswordForEmail(sentTo.email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });
    setResendNote(
      resendError
        ? explainAuthError(resendError.message)
        : "Sent again. It can take a minute to arrive.",
    );
  }

  async function continueWithGoogle() {
    setBusy(true);
    setMessage("");
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/app`,
        // Always let the person choose which Google account to use.
        queryParams: { prompt: "select_account" },
      },
    });
    if (oauthError) setError(oauthError.message);
    setBusy(false);
  }

  return (
    <main className="section login-page">
      <div className="wrap login-wrap">
        <a href="/">← ChoreoStudio</a>
        <h1 className="display login-title">{headings[mode]}</h1>
        <div className="window">
          <div className="window-bar chrome-font">
            {mode === "register" ? "Register.dialog" : "Sign-in.dialog"}
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
                  aria-selected={mode === "register"}
                  variant={mode === "register" ? "retro" : "retroPaper"}
                  onClick={() => setMode("register")}
                >
                  Register
                </Button>
              </div>
            )}
            <form onSubmit={submit}>
              <label className="form-label">
                Email
                <input
                  className="field"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={255}
                  autoComplete="email"
                  aria-invalid={error !== "" && mode === "forgot"}
                />
              </label>
              {error !== "" && mode === "forgot" && (
                <p role="alert" className="login-error">
                  {error}
                </p>
              )}
              {mode !== "forgot" && (
                <label className="form-label login-field">
                  Password
                  <input
                    className="field"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    aria-invalid={error !== ""}
                    required
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                  />
                </label>
              )}
              {error !== "" && mode !== "forgot" && (
                <p role="alert" className="login-error">
                  {error}
                </p>
              )}
              {mode === "register" && (
                <ul className="login-rubric" aria-label="Password requirements">
                  {checkPassword(password, email).map((rule) => (
                    <li key={rule.id} data-met={rule.met}>
                      {rule.met ? "✓" : "○"} {rule.label}
                    </li>
                  ))}
                </ul>
              )}
              <div className="login-actions">
                <Button
                  variant="retro"
                  type="submit"
                  disabled={busy || (mode === "register" && !passwordMeetsRubric(password, email))}
                >
                  {mode === "forgot"
                    ? "Send reset link"
                    : mode === "register"
                      ? "Create account"
                      : "Sign in"}
                </Button>
              </div>
            </form>
            {mode !== "forgot" && (
              <div className="login-actions">
                <Button
                  variant="retroPaper"
                  type="button"
                  onClick={continueWithGoogle}
                  disabled={busy}
                >
                  Continue with Google
                </Button>
              </div>
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
              ) : (
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setMode("forgot");
                  }}
                >
                  Forgot password?
                </a>
              )}
            </p>
            <p role="status" className="login-message">
              {message}
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
                ? "Open it to finish signing up, then come back here and sign in."
                : "Open it to choose a new password."}
            </p>
            <p className="console-hint">
              It can take a minute. Check your spam or promotions folder too.
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
