import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { checkPassword, explainAuthError, passwordMeetsRubric } from "@/lib/password-rubric";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password | Choreo Studio" },
      { name: "description", content: "Choose a new password for your Choreo Studio account." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPassword,
});

type Phase = "checking" | "ready" | "invalid" | "done";

function ResetPassword() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // The email link signs the person in with a recovery session. The client library strips the
  // link's hash once it has read it, so rely on the session, not on the address bar.
  useEffect(() => {
    const failed = /error=|error_code=/.test(window.location.hash);
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setEmail(session?.user.email ?? "");
        setPhase((current) => (current === "done" ? current : "ready"));
      }
    });
    void supabase.auth.getSession().then(({ data: current }) => {
      if (current.session) {
        setEmail(current.session.user.email ?? "");
        setPhase((phase) => (phase === "done" ? phase : "ready"));
      }
    });
    const timer = window.setTimeout(
      () => {
        setPhase((current) => (current === "checking" ? "invalid" : current));
      },
      failed ? 0 : 2500,
    );
    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(explainAuthError(updateError.message));
      return;
    }
    setPhase("done");
  }

  return (
    <main className="section login-page">
      <div className="wrap login-wrap">
        <a href="/login">← Sign in</a>
        <h1 className="display login-title">Reset password.</h1>
        <div className="window">
          <div className="window-bar chrome-font">Reset.dialog</div>
          <div className="window-inner">
            {phase === "checking" && <p role="status">Checking your reset link…</p>}
            {phase === "invalid" && (
              <>
                <p role="alert" className="login-error">
                  This reset link is invalid or has expired. Request a new one from the sign-in
                  page.
                </p>
                <p className="login-links">
                  <a href="/login">Back to sign in</a>
                </p>
              </>
            )}
            {phase === "done" && (
              <>
                <p role="status" className="login-message">
                  Password updated.
                </p>
                <div className="login-actions">
                  <Button variant="retro" onClick={() => window.location.assign("/app")}>
                    Go to the console
                  </Button>
                </div>
              </>
            )}
            {phase === "ready" && (
              <form onSubmit={submit}>
                <label className="form-label">
                  New password
                  <input
                    className="field"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    aria-invalid={error !== ""}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                  />
                </label>
                {error !== "" && (
                  <p role="alert" className="login-error">
                    {error}
                  </p>
                )}
                <ul className="login-rubric" aria-label="Password requirements">
                  {checkPassword(password, email).map((rule) => (
                    <li key={rule.id} data-met={rule.met}>
                      {rule.met ? "✓" : "○"} {rule.label}
                    </li>
                  ))}
                </ul>
                <div className="login-actions">
                  <Button
                    variant="retro"
                    type="submit"
                    disabled={busy || !passwordMeetsRubric(password, email)}
                  >
                    Save new password
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
