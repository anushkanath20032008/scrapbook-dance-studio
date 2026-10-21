import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createSubscriptionCheckout, openBillingPortal } from "@/lib/billing.functions";
import { studioPlans, subscriptionNote, type StudioPlanId } from "@/lib/plans";
import { getProfile, saveProfile } from "@/lib/profile.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Studio account | Choreo Studio" },
      {
        name: "description",
        content: "Sign in or create a Choreo Studio account for your dance studio.",
      },
      { property: "og:title", content: "Studio account | Choreo Studio" },
      {
        property: "og:description",
        content: "Manage your Choreo Studio account and studio details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Account,
});
function Account() {
  const [user, setUser] = useState<{ email?: string } | null>(null),
    [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "register" | "forgot">("sign-in");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [studioName, setStudioName] = useState(""),
    [phone, setPhone] = useState(""),
    [city, setCity] = useState("");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [billing, setBilling] = useState({ plan: "waitlist", status: "not_started" }),
    [checkoutPlan, setCheckoutPlan] = useState<StudioPlanId | null>(null),
    [justPaid, setJustPaid] = useState(false);
  const canChoosePlan = !justPaid && billing.status === "not_started";
  const loadProfile = useServerFn(getProfile),
    save = useServerFn(saveProfile),
    startCheckout = useServerFn(createSubscriptionCheckout),
    openPortal = useServerFn(openBillingPortal);
  useEffect(() => {
    setJustPaid(new URLSearchParams(window.location.search).get("billing") === "success");
  }, []);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user);
        setReady(true);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    loadProfile()
      .then((p) => {
        if (p) {
          setName(p.name);
          setStudioName(p.studio_name);
          setPhone(p.phone ?? "");
          setCity(p.city ?? "");
          setBilling({ plan: p.plan, status: p.billing_status });
        }
      })
      .catch(() => {});
  }, [user, loadProfile]);
  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage("Check your email for a password reset link.");
      } else if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/account` },
        });
        if (error) throw error;
        setMessage(
          "Check your email to confirm your account, then sign in to save your studio details.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("Signed in.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function handleProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: { name, studioName, phone, city } });
      setMessage("Studio details saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save details.");
    } finally {
      setBusy(false);
    }
  }
  async function manageBilling() {
    setBusy(true);
    setMessage("");
    try {
      const { portalUrl } = await openPortal();
      window.location.assign(portalUrl);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not open billing.");
      setBusy(false);
    }
  }
  async function choosePlan(plan: StudioPlanId) {
    setCheckoutPlan(plan);
    setMessage("");
    try {
      const { checkoutUrl } = await startCheckout({ data: { plan } });
      window.location.assign(checkoutUrl);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not start checkout.");
      setCheckoutPlan(null);
    }
  }
  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/account" },
    });
    if (error) setMessage(error.message);
    setBusy(false);
  }
  return (
    <main className="section account-page">
      <div className="wrap account-wrap">
        <a href="/">← Choreo Studio</a>
        <h1 className="display">Studio account.</h1>
        <div className="window">
          <div className="window-bar">
            <span className="chrome-font">Choreo Studio / account</span>
            <span className="window-controls">
              <i />
              <i />
            </span>
          </div>
          <div className="window-inner">
            {!ready ? (
              <p>Loading account...</p>
            ) : user ? (
              <>
                <p>
                  Signed in as <strong>{user.email}</strong>
                </p>
                <form onSubmit={handleProfile}>
                  <p>Keep your studio details here.</p>
                  {[
                    ["Your name", name, setName],
                    ["Studio name", studioName, setStudioName],
                    ["Phone", phone, setPhone],
                    ["City", city, setCity],
                  ].map(([label, value, setter]) => (
                    <div key={label as string} style={{ marginBottom: 13 }}>
                      <label className="form-label">
                        {label as string}
                        <input
                          className="field"
                          value={value as string}
                          onChange={(e) => (setter as (value: string) => void)(e.target.value)}
                          required={label === "Your name" || label === "Studio name"}
                        />
                      </label>
                    </div>
                  ))}
                  <Button variant="retro" type="submit" disabled={busy}>
                    Save studio details
                  </Button>
                </form>
                <section className="account-pricing" aria-labelledby="plans-heading">
                  <h2 id="plans-heading">Studio subscription</h2>
                  <p>
                    Current plan: <strong>{readable(billing.plan)}</strong> · Billing:{" "}
                    <strong>{readable(billing.status)}</strong>
                  </p>
                  {billing.status === "not_started" && (
                    <p>Your first month is free. Choose a plan when you want to keep going.</p>
                  )}
                  <p className="pricing-footnote">{subscriptionNote}</p>
                  {justPaid && (
                    <p role="status">
                      <strong>Payment received.</strong> Your plan activates once Dodo Payments
                      confirms it.
                    </p>
                  )}
                  {!canChoosePlan && billing.status !== "not_started" && (
                    <div style={{ marginTop: 12 }}>
                      <Button variant="retro" type="button" disabled={busy} onClick={manageBilling}>
                        Manage billing
                      </Button>
                      <p className="pricing-footnote">
                        Update your card, change plan, cancel or download invoices on Dodo's secure page.
                      </p>
                    </div>
                  )}
                  {canChoosePlan && (
                    <div className="pricing-grid">
                      {studioPlans.map((plan) => (
                        <article className="pricing-card" key={plan.id}>
                          <h3>{plan.name}</h3>
                          <p className="pricing-price">
                            {plan.price}
                            <span>/month</span>
                          </p>
                          <ul>
                            {plan.features.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                          <Button
                            variant={plan.id === "studio" ? "retro" : "retroPaper"}
                            disabled={busy || checkoutPlan !== null}
                            onClick={() => choosePlan(plan.id)}
                          >
                            {checkoutPlan === plan.id ? "Opening checkout..." : "Choose plan"}
                          </Button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                <div style={{ marginTop: 22 }}>
                  <a href="/app">Open your studio console</a> · <a href="/admin">View waitlist</a>{" "}
                  <Button variant="retroPaper" onClick={() => supabase.auth.signOut()}>
                    Sign out
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                  <Button
                    variant={mode === "sign-in" ? "retro" : "retroPaper"}
                    onClick={() => setMode("sign-in")}
                  >
                    Sign in
                  </Button>
                  <Button
                    variant={mode === "register" ? "retro" : "retroPaper"}
                    onClick={() => setMode("register")}
                  >
                    Register
                  </Button>
                </div>
                <form onSubmit={handleAuth}>
                  <label className="form-label">
                    Email
                    <input
                      className="field"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={255}
                      autoComplete="email"
                    />
                  </label>
                  {mode !== "forgot" && (
                    <label className="form-label" style={{ marginTop: 12 }}>
                      Password
                      <input
                        className="field"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        autoComplete={mode === "register" ? "new-password" : "current-password"}
                      />
                    </label>
                  )}
                  <div style={{ marginTop: 20 }}>
                    <Button variant="retro" type="submit" disabled={busy}>
                      {mode === "forgot"
                        ? "Send reset link"
                        : mode === "register"
                          ? "Create account"
                          : "Sign in"}
                    </Button>
                  </div>
                </form>
                <div style={{ marginTop: 18 }}>
                  <Button variant="retroPaper" onClick={google} disabled={busy}>
                    Continue with Google
                  </Button>
                </div>
                <p>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setMode("forgot");
                    }}
                  >
                    Forgot password?
                  </a>
                </p>
              </>
            )}
            <p role="status" className="status-line">
              {message}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
function readable(value: string) {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
