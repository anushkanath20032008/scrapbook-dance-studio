import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ClipboardCheck,
  IndianRupee,
  LayoutGrid,
  ListChecks,
  Repeat,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
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
import { GroupTabs } from "@/components/console/group-tabs";
import { consoleGroups, groupForPath, groupTabs } from "@/lib/console-nav";
import { helpVideos } from "@/lib/help-videos";
import { GuidedTour, tourSeen } from "@/components/console/guided-tour";
import { JoinStudioDialog } from "@/components/console/join-studio-dialog";
import { getInstructorBatches, getMyTeacherStudio } from "@/lib/instructors.functions";
import { TermsGate } from "@/components/console/terms-gate";
import { TERMS_VERSION } from "@/lib/terms";
import { setRoleIntent } from "@/lib/role-intent";

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
  | "/app/my-batches"
  | "/app/my-dancers"
  | "/app/makeups";

// An instructor sees only these two screens; the database refuses everything else even if a URL is typed in.
const instructorItems: { to: NavTo; label: string; exact: boolean }[] = [
  { to: "/app", label: "Home", exact: true },
  { to: "/app/class", label: "Attendance", exact: false },
  { to: "/app/my-batches", label: "Batches", exact: false },
  { to: "/app/my-dancers", label: "Dancers", exact: false },
  { to: "/app/makeups", label: "Make-ups", exact: false },
];
const instructorPaths = instructorItems.map((item) => item.to as string);

// Shown only when billing has a problem; a studio that has not started or is paying hears nothing.
const needsBillingAttention = (status: string | undefined) =>
  status !== undefined && !["not_started", "active", "trialing"].includes(status);

function ConsoleLayout() {
  const navigate = useNavigate();
  const session = useOwnerSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [billingNoticeShut, setBillingNoticeShut] = useState(false);
  // On a wide screen the menu is open until the hamburger folds it away; on a phone it is closed until opened.
  const [folded, setFolded] = useState(false);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 761px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const navExpanded = wide ? !folded : menuOpen;
  const [tourOpen, setTourOpen] = useState(false);
  // The tour points at menu items, so the menu must be showing while it runs.
  useEffect(() => {
    if (tourOpen) setFolded(false);
  }, [tourOpen]);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const loadContext = useServerFn(getConsoleContext);
  // Someone who chose "I am a dance teacher" is asked which studio they teach at before anything is created for them.
  const [teacherIntent, setTeacherIntent] = useState(false);
  const loadTeacherStudio = useServerFn(getMyTeacherStudio);
  const teacherStudio = useQuery({
    queryKey: ["teacher-studio"],
    queryFn: () => loadTeacherStudio(),
    enabled: session.status === "signed-in" && teacherIntent,
  });
  const loadMyBatches = useServerFn(getInstructorBatches);
  const myBatches = useQuery({
    queryKey: ["instructor-batches"],
    queryFn: () => loadMyBatches(),
    enabled: session.status === "signed-in" && session.teacher,
  });
  const [batchesOpen, setBatchesOpen] = useState(() => {
    try {
      return window.localStorage.getItem("choreo-batches-open") !== "no";
    } catch {
      return true;
    }
  });
  const toggleBatches = () =>
    setBatchesOpen((open) => {
      try {
        window.localStorage.setItem("choreo-batches-open", open ? "no" : "yes");
      } catch {
        // Not remembering the fold state is harmless.
      }
      return !open;
    });
  const [joinHidden, setJoinHidden] = useState(false);
  const [termsDone, setTermsDone] = useState(false);
  // A teacher who confirmed their email on another device has no local hint, but the account remembers.
  // Only the account decides this. A browser-wide hint is not used: it outlives sign-out and would send the next
  // person to sign in here, such as a studio owner, to the teacher screen.
  useEffect(() => {
    setTeacherIntent(session.status === "signed-in" && session.teacher);
    if (session.status === "signed-in") setRoleIntent("owner");
  }, [session]);
  // Someone is asked to join only when the account is a teacher in name but has neither a studio of its own nor a
  // studio it teaches at.
  const needsJoin =
    teacherIntent &&
    teacherStudio.data !== undefined &&
    teacherStudio.data.studioName === null &&
    !teacherStudio.data.ownsStudio;
  const mustJoin = teacherIntent && (teacherStudio.isPending || needsJoin);
  const context = useQuery({
    queryKey: ["console-context"],
    queryFn: () => loadContext(),
    enabled: session.status === "signed-in" && !mustJoin,
  });

  const isInstructor = context.data?.role === "instructor";
  const isOwner = context.data?.role === "owner";
  const tourRole = isInstructor ? "teacher" : isOwner ? "owner" : null;
  // The tour opens by itself once, the first time someone reaches the console.
  useEffect(() => {
    if (tourRole && !tourSeen(tourRole)) setTourOpen(true);
  }, [tourRole]);

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
  const activeGroup = groupForPath(pathname);

  useEffect(() => {
    if (session.status === "signed-out") void navigate({ to: "/login" });
  }, [session.status, navigate]);

  // An instructor who lands anywhere but their two screens is sent to Home.
  useEffect(() => {
    if (isInstructor && !instructorPaths.includes(pathname.replace(/\/+$/, ""))) {
      void navigate({ to: "/app", replace: true });
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
          aria-label={navExpanded ? "Close navigation" : "Open navigation"}
          aria-expanded={navExpanded}
          onClick={() => (wide ? setFolded((value) => !value) : setMenuOpen((open) => !open))}
        >
          ☰
        </button>
        <a className="brand" href="/" aria-label="ChoreoStudio home">
          <img className="brand-mark" src="/logo-mark.svg" alt="" width="24" height="24" />
          ChoreoStudio
        </a>
        <span className="console-studio">{context.data?.studioName || session.email}</span>
      </header>
      <div className={`console-body${folded ? " folded" : ""}`}>
        {isInstructor ? (
          <nav
            className={`console-nav${menuOpen ? " open" : ""}`}
            aria-label="Dance teacher navigation"
          >
            {instructorItems
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  exact={item.exact}
                  tour={item.label.toLowerCase().replace(/[^a-z]/g, "")}
                  onPick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))
              .flatMap((link, index) =>
                instructorItems[index]?.to === "/app/my-batches" &&
                (myBatches.data?.length ?? 0) > 0
                  ? [
                      <div key="batches-head" className="console-nav-fold">
                        {link}
                        <button
                          type="button"
                          className="console-fold-toggle"
                          aria-expanded={batchesOpen}
                          aria-label={batchesOpen ? "Hide your batches" : "Show your batches"}
                          onClick={toggleBatches}
                        >
                          {batchesOpen ? "▾" : "▸"}
                        </button>
                      </div>,
                      <ul
                        key="batch-subnav"
                        className="console-subnav"
                        aria-label="Your batches"
                        hidden={!batchesOpen}
                      >
                        {myBatches.data?.map((batch) => (
                          <li key={batch.id}>
                            <Link
                              to="/app/my-batches"
                              search={{ batch: batch.id }}
                              className="console-nav-item console-nav-sub"
                              activeOptions={{ includeSearch: true }}
                              activeProps={{ className: "active" }}
                              onClick={() => setMenuOpen(false)}
                            >
                              {batch.name}
                            </Link>
                          </li>
                        ))}
                      </ul>,
                    ]
                  : [link],
              )}
            <div className="console-nav-foot">
              <Button
                variant="retroPaper"
                title="A one-minute walk through the menu"
                onClick={() => setTourOpen(true)}
              >
                Take the tour
              </Button>
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
            {consoleGroups.map((group) => (
              <Fragment key={group.id}>
                <NavLink
                  to={group.to as NavTo}
                  exact={group.exact}
                  active={activeGroup === group.id}
                  tour={group.id}
                  badge={group.id === "money" ? toVerify : 0}
                  hint={group.hint}
                  onPick={() => setMenuOpen(false)}
                >
                  {group.label}
                </NavLink>
                {group.id === "studio" && (
                  <ul className="console-subnav" aria-label="Studio pages">
                    {groupTabs("studio", false).map((tab) => (
                      <li key={tab.to}>
                        <Link
                          to={tab.to}
                          title={tab.hint}
                          className="console-nav-sub"
                          aria-current={
                            pathname.replace(/\/+$/, "") === tab.to ? "page" : undefined
                          }
                          onClick={() => setMenuOpen(false)}
                        >
                          {tab.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Fragment>
            ))}
            <div className="console-nav-foot">
              {context.data?.isPlatformOwner && (
                <Link to="/admin" className="console-nav-item">
                  Studio enquiries
                </Link>
              )}
              <Button
                variant="retroPaper"
                title="A one-minute walk through the menu"
                onClick={() => setTourOpen(true)}
              >
                Take the tour
              </Button>
              <Button variant="retroPaper" onClick={() => supabase.auth.signOut()}>
                Sign out
              </Button>
            </div>
          </nav>
        )}
        {tourOpen && tourRole && (
          <GuidedTour
            role={tourRole}
            onClose={() => setTourOpen(false)}
            onNavigate={(to) => void navigate({ to: to as NavTo })}
          />
        )}
        <main className="console-main">
          {session.termsVersion !== TERMS_VERSION && !termsDone && (
            <TermsGate onAccepted={() => setTermsDone(true)} />
          )}
          {needsJoin && !joinHidden && (
            <JoinStudioDialog
              onLeave={() => setTeacherIntent(false)}
              onDismiss={() => setJoinHidden(true)}
            />
          )}
          {needsJoin && joinHidden && (
            <div className="console-form">
              <h2>You have not joined a studio yet</h2>
              <p>
                Ask your studio owner for an invite code. Nothing is set up for you until you join.
              </p>
              <div className="console-actions">
                <Button variant="retro" type="button" onClick={() => setJoinHidden(false)}>
                  Enter an invite code
                </Button>
                <Button variant="retroPaper" type="button" onClick={() => supabase.auth.signOut()}>
                  Sign out
                </Button>
              </div>
            </div>
          )}
          {context.isError && <p role="alert">Could not load your studio. Please refresh.</p>}
          {/* Wait to learn the role, so an instructor never briefly opens an owner screen. */}
          {context.isPending ? (
            <span className="skeleton-block skeleton-card" />
          ) : (
            <>
              {isOwner && context.data?.hasAccess === false && (
                <div className="paywall" role="alert">
                  <strong>Your free month has ended</strong>
                  <p>
                    Everything you have added is safe and you can still look at it. To add dancers,
                    mark attendance, record payments or send reminders, subscribe for ₹249 a month.
                  </p>
                  <Link to="/account" className="paywall-cta">
                    Subscribe for ₹249 a month →
                  </Link>
                </div>
              )}
              {isOwner &&
                !billingNoticeShut &&
                needsBillingAttention(context.data?.billingStatus) && (
                  <p className="console-banner" role="status">
                    <span>
                      Your subscription needs attention (
                      {context.data?.billingStatus.replace(/_/g, " ")}).
                    </span>
                    <span className="console-banner-actions">
                      <Link to="/account" className="text-link">
                        Open account
                      </Link>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => setBillingNoticeShut(true)}
                      >
                        Dismiss
                      </button>
                    </span>
                  </p>
                )}
              {!isInstructor && (
                <GroupTabs
                  group={activeGroup}
                  pathname={pathname}
                  messagingConfigured={messaging.data?.providerConfigured === true}
                />
              )}
              {!isInstructor && helpVideos[activeGroup] !== "" && (
                <a
                  className="help-video"
                  href={helpVideos[activeGroup]}
                  target="_blank"
                  rel="noreferrer"
                  title="A short video showing how this section works"
                >
                  ▶ Watch how this works
                </a>
              )}
              <Outlet />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// One plain line icon per menu entry, for both the owner and the teacher menu.
const navIcons: Record<string, LucideIcon> = {
  "/app": LayoutGrid,
  "/app/setup": ListChecks,
  "/app/students": Users,
  "/app/my-dancers": Users,
  "/app/billing": IndianRupee,
  "/app/attendance": ClipboardCheck,
  "/app/class": ClipboardCheck,
  "/app/batches": CalendarDays,
  "/app/my-batches": CalendarDays,
  "/app/makeups": Repeat,
};

function NavLink({
  to,
  exact = false,
  badge = 0,
  hint,
  tour,
  active,
  onPick,
  children,
}: {
  to: NavTo;
  exact?: boolean;
  active?: boolean;
  badge?: number;
  hint?: string;
  tour?: string;
  onPick: () => void;
  children: string;
}) {
  return (
    <Link
      to={to}
      title={hint}
      data-tour={tour}
      activeOptions={{ exact }}
      activeProps={{ className: "active" }}
      className={`console-nav-item${active ? " active" : ""}`}
      onClick={onPick}
    >
      {navIcons[to] &&
        (() => {
          const Icon = navIcons[to]!;
          return (
            <Icon className="console-nav-icon" size={18} strokeWidth={1.9} aria-hidden="true" />
          );
        })()}
      <span className="console-nav-text">{children}</span>
      {badge > 0 && (
        <span className="console-nav-badge" aria-label={`${badge} waiting`}>
          {badge}
        </span>
      )}
    </Link>
  );
}
