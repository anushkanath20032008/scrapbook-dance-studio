// The console menu as plain data: five groups over unchanged page addresses.
export type GroupId = "overview" | "dancers" | "money" | "attendance" | "studio";

export type ConsoleTab = { to: string; label: string };

export const consoleGroups: { id: GroupId; label: string; to: string; exact: boolean }[] = [
  { id: "overview", label: "Overview", to: "/app", exact: true },
  { id: "dancers", label: "Dancers", to: "/app/students", exact: false },
  { id: "money", label: "Money", to: "/app/billing", exact: false },
  { id: "attendance", label: "Attendance", to: "/app/attendance", exact: false },
  { id: "studio", label: "Studio", to: "/app/batches", exact: false },
];

const moneyTabs: ConsoleTab[] = [
  { to: "/app/billing", label: "Billing" },
  { to: "/app/verify", label: "Payments to check" },
  { to: "/app/month-end", label: "Month end" },
  { to: "/app/messages", label: "Messages" },
  { to: "/app/insights", label: "Insights" },
];

const studioTabs: ConsoleTab[] = [
  { to: "/app/batches", label: "Batches" },
  { to: "/app/plans", label: "Fee plans" },
  { to: "/app/makeups", label: "Make-ups" },
  { to: "/app/team", label: "Team" },
  { to: "/account", label: "Account" },
];

export const navLabels: string[] = [
  ...consoleGroups.map((group) => group.label),
  ...moneyTabs.map((tab) => tab.label),
  ...studioTabs.map((tab) => tab.label),
];

const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

export function groupForPath(rawPath: string): GroupId {
  const path = trim(rawPath);
  if (moneyTabs.some((tab) => under(path, tab.to))) return "money";
  if (studioTabs.some((tab) => under(path, tab.to))) return "studio";
  if (under(path, "/app/students")) return "dancers";
  if (under(path, "/app/attendance")) return "attendance";
  return "overview";
}

export function groupTabs(group: GroupId, messagingConfigured: boolean): ConsoleTab[] {
  if (group === "money") {
    return moneyTabs.filter((tab) => tab.to !== "/app/messages" || messagingConfigured);
  }
  if (group === "studio") return studioTabs;
  return [];
}
