import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  createSubscriptionCheckout,
  getBillingAvailability,
  openBillingPortal,
} from "@/lib/billing.functions";
import { getConsoleContext } from "@/lib/console.functions";
import { formatDayWithYear } from "@/lib/format";
import { accountPlanSummary } from "@/lib/account-plan";
import { studioPlans, subscriptionNote, type StudioPlanId } from "@/lib/plans";
import { getProfile, saveProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Studio account | ChoreoStudio" },
      { name: "description", content: "Your studio details and subscription." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Account,
});

function Account() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [studioName, setStudioName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [saved, setSaved] = useState("");
  const [saveError, setSaveError] = useState("");
  const [billingError, setBillingError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<StudioPlanId | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  const loadProfile = useServerFn(getProfile);
  const loadContext = useServerFn(getConsoleContext);
  const loadAvailability = useServerFn(getBillingAvailability);
  const save = useServerFn(saveProfile);
  const startCheckout = useServerFn(createSubscriptionCheckout);
  const openPortal = useServerFn(openBillingPortal);

  useEffect(() => {
    setJustPaid(new URLSearchParams(window.location.search).get("billing") === "success");
  }, []);
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
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
  // The one sign-in screen is /login, so there is a single place with the password rules and recovery help.
  useEffect(() => {
    if (ready && !user) void navigate({ to: "/login" });
  }, [ready, user, navigate]);

  const profile = useQuery({
    queryKey: ["account-profile"],
    queryFn: () => loadProfile(),
    enabled: user !== null,
  });
  const context = useQuery({
    queryKey: ["console-context"],
    queryFn: () => loadContext(),
    enabled: user !== null,
  });
  const availability = useQuery({
    queryKey: ["billing-availability"],
    queryFn: () => loadAvailability(),
    enabled: user !== null,
  });
  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setName(p.name);
    setStudioName(p.studio_name);
    setPhone(p.phone ?? "");
    setCity(p.city ?? "");
  }, [profile.data]);

  async function handleProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved("");
    setSaveError("");
    try {
      await save({ data: { name, studioName, phone, city } });
      setSaved("Saved.");
    } catch (err) {
      setSaveError(
        err instanceof Error && /invalid|too_small|regex/i.test(err.message)
          ? "Check the name, studio name and phone number. The phone number needs 10 digits."
          : "Could not save your details. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function manageBilling() {
    setBusy(true);
    setBillingError("");
    try {
      const { portalUrl } = await openPortal();
      window.location.assign(portalUrl);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Could not open billing.");
      setBusy(false);
    }
  }
  async function choosePlan(plan: StudioPlanId) {
    setCheckoutPlan(plan);
    setBillingError("");
    try {
      const { checkoutUrl } = await startCheckout({ data: { plan } });
      window.location.assign(checkoutUrl);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Could not start checkout.");
      setCheckoutPlan(null);
    }
  }

  const summary = context.data
    ? accountPlanSummary({
        plan: context.data.plan,
        billingStatus: context.data.billingStatus,
        trialEndsAt: context.data.trialEndsAt,
        studentLimit: context.data.studentLimit,
        studentCount: context.data.studentCount,
        now: new Date(),
      })
    : null;
  const canBuy = availability.data?.checkout === true;
  const canManage = availability.data?.portal === true && summary?.hasSubscription === true;

  return (
    <main className="section account-page">
      <div className="wrap account-wrap">
        <a href="/app">← Back to your studio</a>
        <h1 className="display">Studio account.</h1>
        <div className="window">
          <div className="window-bar">
            <span className="chrome-font">ChoreoStudio / account</span>
            <span className="window-controls">
              <i />
              <i />
            </span>
          </div>
          <div className="window-inner">
            {!ready || !user ? (
              <p role="status">{ready ? "Taking you to sign in…" : "Loading your account…"}</p>
            ) : (
              <>
                <p>
                  Signed in as <strong>{user.email}</strong>
                </p>
                <form onSubmit={handleProfile}>
                  <p className="console-hint">
                    Your studio name appears in the reminders you send and on your dancers&apos; private
                    links.
                  </p>
                  <label className="form-label account-field">
                    Your name
                    <input
                      className="field"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      minLength={2}
                      autoComplete="name"
                    />
                  </label>
                  <label className="form-label account-field">
                    Studio name
                    <input
                      className="field"
                      value={studioName}
                      onChange={(e) => setStudioName(e.target.value)}
                      required
                      minLength={2}
                    />
                  </label>
                  <label className="form-label account-field">
                    Phone
                    <input
                      className="field"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                    />
                  </label>
                  <label className="form-label account-field">
                    City
                    <input
                      className="field"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      autoComplete="address-level2"
                    />
                  </label>
                  <Button variant="retro" type="submit" disabled={busy}>
                    Save studio details
                  </Button>
                  {saved && (
                    <p role="status" className="console-notice">
                      ✓ {saved}
                    </p>
                  )}
                  {saveError && (
                    <p role="alert" className="login-error">
                      {saveError}
                    </p>
                  )}
                </form>

                <section className="account-pricing" aria-labelledby="plans-heading">
                  <h2 id="plans-heading">Your plan</h2>
                  {justPaid && (
                    <p role="status">
                      <strong>Thank you.</strong> Your plan switches on as soon as the payment is
                      confirmed. This can take a minute: refresh this page.
                    </p>
                  )}
                  {summary ? (
                    <>
                      <p className="account-plan-line">
                        <strong>{summary.headline}</strong>
                      </p>
                      <p>{summary.detail}</p>
                    </>
                  ) : (
                    <p>Loading your plan…</p>
                  )}
                  {billingError && (
                    <p role="alert" className="login-error">
                      {billingError}
                    </p>
                  )}
                  {canManage && (
                    <div style={{ marginTop: 12 }}>
                      <Button variant="retro" type="button" disabled={busy} onClick={manageBilling}>
                        Manage billing
                      </Button>
                      <p className="pricing-footnote">
                        Update your card, change plan, cancel or download invoices on the secure
                        payments page.
                      </p>
                    </div>
                  )}
                  {summary?.canChoosePlan && !justPaid && (
                    <>
                      {availability.data && !canBuy && (
                        <p className="account-notice" role="status">
                          Paid plans cannot be bought online yet. Nothing for you to do now: your free
                          month and everything you have added are not affected.
                        </p>
                      )}
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
                            {availability.data?.plans[plan.id] && (
                              <Button
                                variant={plan.id === "studio" ? "retro" : "retroPaper"}
                                disabled={busy || checkoutPlan !== null}
                                onClick={() => void choosePlan(plan.id)}
                              >
                                {checkoutPlan === plan.id ? "Opening checkout..." : "Choose plan"}
                              </Button>
                            )}
                          </article>
                        ))}
                      </div>
                      <p className="pricing-footnote">{subscriptionNote}</p>
                    </>
                  )}
                  {summary?.trialEndsOn && (
                    <p className="console-hint">
                      Your free month ends on {formatDayWithYear(summary.trialEndsOn)}.
                    </p>
                  )}
                </section>
                <div className="account-footer">
                  <a href="/app">Open your studio console</a>
                  {context.data?.isPlatformOwner && <a href="/admin">View waitlist</a>}
                  <Button
                    variant="retroPaper"
                    onClick={() =>
                      void supabase.auth.signOut().then(() => navigate({ to: "/login" }))
                    }
                  >
                    Sign out
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
