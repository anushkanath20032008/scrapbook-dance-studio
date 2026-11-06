// The console menu as plain data: five groups over unchanged page addresses.
export type GroupId = "overview" | "batches" | "attendance" | "studio";

export type ConsoleTab = { to: string; label: string; hint: string };

export const consoleGroups: {
  id: GroupId;
  label: string;
  to: string;
  exact: boolean;
  hint: string;
}[] = [
  {
    id: "overview",
    label: "Home",
    to: "/app",
    exact: true,
    hint: "Tiles for every screen, plus who owes fees this month",
  },
  {
    id: "batches",
    label: "Batches",
    to: "/app/batches",
    exact: false,
    hint: "Your classes, who is in them, and every dancer in the studio",
  },
  {
    id: "attendance",
    label: "Attendance",
    to: "/app/attendance",
    exact: false,
    hint: "Mark who came to class",
  },
  {
    id: "studio",
    label: "Studio",
    to: "/app/batches",
    exact: false,
    hint: "Batches, fee plans, make-ups, teachers and your account",
  },
];

// Everything about who dances where. Billing lives on each dancer's card, opened from their name on Home.
const batchTabs: ConsoleTab[] = [
  { to: "/app/batches", label: "Batches", hint: "Your classes: when they meet and who is in them" },
  {
    to: "/app/students",
    label: "All dancers",
    hint: "Add, find and edit the dancers in your studio",
  },
  { to: "/app/plans", label: "Fee plans", hint: "The monthly fee amounts you charge" },
];

const studioTabs: ConsoleTab[] = [
  {
    to: "/app/makeups",
    label: "Make-ups",
    hint: "Plan a make-up class for dancers who missed one",
  },
  { to: "/app/team", label: "Team", hint: "Invite or remove dance teachers" },
  { to: "/account", label: "Account", hint: "Your studio details, plan and due day" },
];

export const navLabels: string[] = [
  ...consoleGroups.map((group) => group.label),
  ...batchTabs.map((tab) => tab.label),
  ...studioTabs.map((tab) => tab.label),
];

const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

export function groupForPath(rawPath: string): GroupId {
  const path = trim(rawPath);
  if (studioTabs.some((tab) => under(path, tab.to)) || under(path, "/app/messages"))
    return "studio";
  if (batchTabs.some((tab) => under(path, tab.to))) return "batches";
  if (under(path, "/app/attendance")) return "attendance";
  return "overview";
}

export function groupTabs(group: GroupId, messagingConfigured: boolean): ConsoleTab[] {
  if (group === "batches") return batchTabs;
  if (group === "studio")
    return messagingConfigured
      ? [
          ...studioTabs.slice(0, 2),
          {
            to: "/app/messages",
            label: "Messages",
            hint: "WhatsApp reminders that were queued or sent",
          },
          ...studioTabs.slice(2),
        ]
      : studioTabs;
  return [];
}

/** A tile on a role's home page. `badge` names the live number shown on it, filled in by the page. */
export type HomeTile = {
  icon?: string;
  to: string;
  label: string;
  hint: string;
  badge?: "unpaid" | "toCheck" | "requests" | "myRequests";
};

export const ownerTiles: HomeTile[] = [
  { icon: "users", to: "/app/students", label: "Dancers", hint: "Add, find and edit your dancers" },
  {
    icon: "indian-rupee",
    to: "/app/billing",
    label: "Billing",
    hint: "Charge fees and record payments",
    badge: "unpaid",
  },
  {
    icon: "badge-check",
    to: "/app/verify",
    label: "Payments to check",
    hint: "Payments dancers say they made",
    badge: "toCheck",
  },
  {
    icon: "clipboard-check",
    to: "/app/attendance",
    label: "Attendance",
    hint: "Mark who came to class",
  },
  {
    icon: "calendar-days",
    to: "/app/batches",
    label: "Batches",
    hint: "Your classes and teacher requests",
    badge: "requests",
  },
  { icon: "tag", to: "/app/plans", label: "Fee plans", hint: "The monthly fee amounts you charge" },
  {
    icon: "repeat",
    to: "/app/makeups",
    label: "Make-ups",
    hint: "Plan a class for dancers who missed one",
  },
  {
    icon: "graduation-cap",
    to: "/app/team",
    label: "Team",
    hint: "Invite or remove dance teachers",
  },
  {
    icon: "calendar-check",
    to: "/app/month-end",
    label: "Month end",
    hint: "Billed, collected and still pending",
  },
  {
    icon: "chart-line",
    to: "/app/insights",
    label: "Insights",
    hint: "Charts of fees and attendance",
  },
  { icon: "settings", to: "/account", label: "Account", hint: "Studio details, plan and due day" },
];

export const teacherTiles: HomeTile[] = [
  {
    icon: "clipboard-check",
    to: "/app/class",
    label: "Take attendance",
    hint: "Pick a batch and mark who came",
  },
  {
    icon: "users",
    to: "/app/my-dancers",
    label: "Dancers",
    hint: "Everyone in the studio, with their batches and contact details",
  },
  {
    icon: "calendar-days",
    to: "/app/my-batches",
    label: "My batches",
    hint: "Your classes, rosters and batch suggestions",
    badge: "myRequests",
  },
  {
    icon: "repeat",
    to: "/app/makeups",
    label: "Make-ups",
    hint: "Make-up classes for dancers who missed one",
  },
];
