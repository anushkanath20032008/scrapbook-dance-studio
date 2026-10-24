import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { setupCountsKey } from "@/components/console/console-data";
import { useOwnerSession } from "@/hooks/use-owner";
import { supabase } from "@/integrations/supabase/client";
import { listClaimQueue } from "@/lib/claims.functions";
import { getConsoleContext } from "@/lib/console.functions";
import { getMessagingStatus } from "@/lib/reminders.functions";
import { buildSetupSteps, setupProgress } from "@/lib/setup-progress";
import { getSetupCounts } from "@/lib/setup.functions";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Console | ChoreoStudio" },
      {
        name: "description",
        content: "Run your dance studio: fees, batches, students and attendance.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ConsoleLayout,
});

type NavTo =
  | "/app"
  | "/app/setup"
  | "/app/students"
  | "/app/batches"
  | "/app/plans"
  | "/app/billing"
  | "/app/attendance"
  | "/app/month-end"
  | "/app/insights"
  | "/app/messages"
  | "/app/verify"
  | "/app/team"
  | "/app/class"
  | "/app/my-batches";

// The things an owner does every week come first; the one-time set-up screens sit under their own label.
const dailyItems: { to: NavTo; label: string; exact: boolean }[] = [
  { to: "/app", label: "Overview", exact: true },
  { to: "/app/students", label: "Dancers", exact: false },
  { to: "/app/billing", label: "Billing", exact: false },
  { to: "/app/verify", label: "To verify", exact: false },
  { to: "/app/month-end", label: "Month end", exact: false },
  { to: "/app/attendance", label: "Attendance", exact: false },
  { to: "/app/insights", label: "Insights", exact: false },
];
const studioItems: { to: NavTo; label: string; exact: boolean }[] = [
  { to: "/app/batches", label: "Batches", exact: false },
  { to: "/app/plans", label: "Fee plans", exact: false },
  { to: "/app/team", label: "Team", exact: false },
];
// An instructor sees only these two screens; the database refuses everything else even if a URL is typed in.
const instructorItems: { to: NavTo; label: string; exact: boolean }[] = [
  { to: "/app/class", label: "Attendance", exact: false },
  { to: "/app/my-batches", label: "Batches", exact: false },
];
const instructorPaths = instructorItems.map((item) => item.to as string);

const readable = (value: string) => value.replace(/_/g, " ");

const billingTone = (status: string | undefined) =>
  status === "active" ? "good" : status === undefined || status === "not_started" ? "idle" : "warn";

function ConsoleLayout() {
  const navigate = useNavigate();
  const session = useOwnerSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const loadContext = useServerFn(getConsoleContext);
  const context = useQuery({
    queryKey: ["console-context"],
    queryFn: () => loadContext(),
    enabled: session.status === "signed-in",
  });

  const isInstructor = context.data?.role === "instructor";
  const isOwner = context.data?.role === "owner";

  // Small, shared queries: the same keys the screens use, so they are fetched once and reused.
  // Only an owner has anything to load here.
  const loadClaims = useServerFn(listClaimQueue);
  const claims = useQuery({
    queryKey: ["claim-queue"],
    queryFn: () => loadClaims(),
    enabled: session.status === "signed-in" && isOwner,
  });
  const loadMessaging = useServerFn(getMessagingStatus);
  const messaging = useQuery({
    queryKey: ["messaging-status"],
    queryFn: () => loadMessaging(),
    enabled: session.status === "signed-in" && isOwner,
  });
  const loadCounts = useServerFn(getSetupCounts);
  const counts = useQuery({
    queryKey: setupCountsKey,
    queryFn: () => loadCounts(),
    enabled: session.status === "signed-in" && isOwner,
  });
  const setupDone = counts.data ? setupProgress(buildSetupSteps(counts.data)).complete : true;
  const toVerify = claims.data?.length ?? 0;

  useEffect(() => {
    if (session.status === "signed-out") void navigate({ to: "/login" });
  }, [session.status, navigate]);

  // An instructor who lands anywhere but their two screens is sent to Attendance.
  useEffect(() => {
    if (isInstructor && !instructorPaths.includes(pathname.replace(/\/+$/, ""))) {
      void navigate({ to: "/app/class", replace: true });
    }
  }, [isInstructor, pathname, navigate]);

  if (session.status !== "signed-in") {
    return (
      <div className="console" aria-busy="true">
        <header className="console-topbar">
          <a className="brand" href="/" aria-label="ChoreoStudio home">
            <img className="brand-mark" src="/logo-mark.svg" alt="" width="24" height="24" />
            ChoreoStudio
          </a>
        </header>
        <div className="console-body">
          <nav className="console-nav console-skeleton-nav" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} className="skeleton-block" />
            ))}
          </nav>
          <main className="console-main" aria-label="Loading your studio">
            <span className="skeleton-block skeleton-title" />
            <span className="skeleton-block skeleton-card" />
            <span className="skeleton-block skeleton-card" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="console">
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            border: "2px solid var(--ink)",
            borderRadius: 0,
            background: "#dcefdc",
            color: "var(--ink)",
            fontWeight: 800,
            boxShadow: "3px 3px 0 var(--ink)",
          },
        }}
      />
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
        <a className="brand" href="/" aria-label="ChoreoStudio home"><img className="brand-mark" src="/logo-mark.svg" alt="" width="24" height="24"/>ChoreoStudio</a>
        <span className="console-studio">{context.data?.studioName || session.email}</span>
      </header>
      <div className="console-body">
        {isInstructor ? (
        <nav className={`console-nav${menuOpen ? " open" : ""}`} aria-label="Instructor navigation">
          {instructorItems.map((item) => (
            <NavLink key={item.to} to={item.to} onPick={() => setMenuOpen(false)}>
              {item.label}
            </NavLink>
          ))}
          <div className="console-nav-foot">
            <Button variant="retroPaper" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </nav>
        ) : (
        <nav className={`console-nav${menuOpen ? " open" : ""}`} aria-label="Console navigation">
          {!setupDone && (
            <NavLink to="/app/setup" onPick={() => setMenuOpen(false)}>
              Set up your studio
            </NavLink>
          )}
          <span className="console-nav-label">Manage</span>
          {dailyItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              exact={item.exact}
              badge={item.to === "/app/verify" ? toVerify : 0}
              onPick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          <span className="console-nav-label">Studio</span>
          {studioItems.map((item) => (
            <NavLink key={item.to} to={item.to} onPick={() => setMenuOpen(false)}>
              {item.label}
            </NavLink>
          ))}
          {messaging.data?.providerConfigured === true && (
            <NavLink to="/app/messages" onPick={() => setMenuOpen(false)}>
              Messages
            </NavLink>
          )}
          <div className="console-nav-foot">
            <section className="console-plan" aria-label="Your plan">
              <div className="console-plan-bar chrome-font">Your plan</div>
              <dl className="console-plan-body">
                <dt>Plan</dt>
                <dd>
                  <span className="status-pill" data-tone="plan">
                    {context.data?.plan && context.data.plan !== "waitlist" ? readable(context.data.plan) : "No plan yet"}
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
        )}
        <main className="console-main">
          {context.isError && <p role="alert">Could not load your studio. Please refresh.</p>}
          {/* Wait to learn the role, so an instructor never briefly opens an owner screen. */}
          {context.isPending ? <span className="skeleton-block skeleton-card" /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}

function NavLink({
  to,
  exact = false,
  badge = 0,
  onPick,
  children,
}: {
  to: NavTo;
  exact?: boolean;
  badge?: number;
  onPick: () => void;
  children: string;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      activeProps={{ className: "active" }}
      className="console-nav-item"
      onClick={onPick}
    >
      {children}
      {badge > 0 && (
        <span className="console-nav-badge" aria-label={`${badge} waiting`}>
          {badge}
        </span>
      )}
    </Link>
  );
}
