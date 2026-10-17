import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useOwnerSession } from "@/hooks/use-owner";
import { supabase } from "@/integrations/supabase/client";
import { getConsoleContext } from "@/lib/console.functions";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Console | Choreo Studio" },
      {
        name: "description",
        content: "Run your dance studio: fees, batches, students and attendance.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ConsoleLayout,
});

// Each screen is added to this list as it ships.
const navItems: {
  to:
    | "/app"
    | "/app/setup"
    | "/app/students"
    | "/app/batches"
    | "/app/plans"
    | "/app/billing"
    | "/app/attendance"
    | "/app/insights"
    | "/app/messages"
    | "/app/verify";
  label: string;
  exact: boolean;
}[] = [
  { to: "/app", label: "Overview", exact: true },
  { to: "/app/setup", label: "Setup", exact: false },
  { to: "/app/students", label: "Dancers", exact: false },
  { to: "/app/billing", label: "Billing", exact: false },
  { to: "/app/verify", label: "To verify", exact: false },
  { to: "/app/attendance", label: "Attendance", exact: false },
  { to: "/app/messages", label: "Messages", exact: false },
  { to: "/app/insights", label: "Insights", exact: false },
  { to: "/app/batches", label: "Batches", exact: false },
  { to: "/app/plans", label: "Fee plans", exact: false },
];

const readable = (value: string) => value.replace(/_/g, " ");

const billingTone = (status: string | undefined) =>
  status === "active" ? "good" : status === undefined || status === "not_started" ? "idle" : "warn";

function ConsoleLayout() {
  const navigate = useNavigate();
  const session = useOwnerSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const loadContext = useServerFn(getConsoleContext);
  const context = useQuery({
    queryKey: ["console-context"],
    queryFn: () => loadContext(),
    enabled: session.status === "signed-in",
  });

  useEffect(() => {
    if (session.status === "signed-out") void navigate({ to: "/login" });
  }, [session.status, navigate]);

  // A dancer who opened the console by mistake goes to their own area; no studio is created for them.
  useEffect(() => {
    if (context.data?.memberOnly) void navigate({ to: "/me" });
  }, [context.data?.memberOnly, navigate]);

  if (session.status !== "signed-in" || context.data?.memberOnly) {
    return (
      <main className="console-loading">
        <p>Loading your studio…</p>
      </main>
    );
  }

  return (
    <div className="console">
      <header className="console-topbar">
        <button
          type="button"
          className="console-menu-button"
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰
        </button>
        <span className="brand">Choreo Studio</span>
        <span className="console-studio">{context.data?.studioName || session.email}</span>
      </header>
      <div className="console-body">
        <nav className={`console-nav${menuOpen ? " open" : ""}`} aria-label="Console navigation">
          <span className="console-nav-label">Manage</span>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "active" }}
              className="console-nav-item"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="console-nav-foot">
            <section className="console-plan" aria-label="Your plan">
              <div className="console-plan-bar chrome-font">Your plan</div>
              <dl className="console-plan-body">
                <dt>Plan</dt>
                <dd>
                  <span className="status-pill" data-tone="plan">
                    {readable(context.data?.plan ?? "waitlist")}
                  </span>
                </dd>
                <dt>Billing</dt>
                <dd>
                  <span
                    className="status-pill"
                    data-tone={billingTone(context.data?.billingStatus)}
                  >
                    {readable(context.data?.billingStatus ?? "not_started")}
                  </span>
                </dd>
              </dl>
            </section>
            <Link to="/account" className="console-nav-item">
              Account and plans
            </Link>
            {context.data?.isPlatformOwner && (
              <Link to="/admin" className="console-nav-item">
                Waitlist
              </Link>
            )}
            <Button variant="retroPaper" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </nav>
        <main className="console-main">
          {context.isError && <p role="alert">Could not load your studio. Please refresh.</p>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
