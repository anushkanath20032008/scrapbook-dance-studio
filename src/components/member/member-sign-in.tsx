import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { explainAuthError } from "@/lib/password-rubric";

/**
 * Dancer sign-in: Google or an emailed magic link, no password. `next` is the path the browser returns to, and
 * it must be allowed in the Supabase project's redirect URLs. A dancer who has no account yet gets one made
 * on first sign-in; it carries no studio profile.
 */
export function MemberSignIn({ next, title }: { next: string; title: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const redirectTo = () => `${window.location.origin}${next}`;

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
    });
    if (otpError) setError(explainAuthError(otpError.message));
    else setMessage("Check your email for a sign-in link. You can close this tab.");
    setBusy(false);
  }

  async function google() {
    setBusy(true);
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo(), queryParams: { prompt: "select_account" } },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  }

  return (
    <div className="window">
      <div className="window-bar chrome-font">Dancer-sign-in.dialog</div>
      <div className="window-inner">
        <h2 className="console-subhead">{title}</h2>
        <form onSubmit={sendLink}>
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
            />
          </label>
          <div className="login-actions">
            <Button variant="retro" type="submit" disabled={busy || email.trim() === ""}>
              Email me a sign-in link
            </Button>
          </div>
        </form>
        <div className="login-actions">
          <Button variant="retroPaper" type="button" onClick={google} disabled={busy}>
            Continue with Google
          </Button>
        </div>
        {error !== "" && (
          <p role="alert" className="login-error">
            {error}
          </p>
        )}
        <p role="status" className="login-message">
          {message}
        </p>
      </div>
    </div>
  );
}
