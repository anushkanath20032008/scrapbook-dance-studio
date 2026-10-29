// The console menu as plain data: five groups over unchanged page addresses.
export type GroupId = "overview" | "dancers" | "money" | "attendance" | "studio";

export type ConsoleTab = { to: string; label: string; hint: string };

export const consoleGroups: { id: GroupId; label: string; to: string; exact: boolean; hint: string }[] = [
  { id: "overview", label: "Overview", to: "/app", exact: true, hint: "Who owes fees this month and what needs doing today" },
  { id: "dancers", label: "Dancers", to: "/app/students", exact: false, hint: "Add, find and edit the dancers in your studio" },
  { id: "money", label: "Payments", to: "/app/billing", exact: false, hint: "Fees due, payments to check and the month-end summary" },
  { id: "attendance", label: "Attendance", to: "/app/attendance", exact: false, hint: "Mark who came to class" },
  { id: "studio", label: "Studio", to: "/app/batches", exact: false, hint: "Batches, fee plans, make-ups, teachers and your account" },
];

const moneyTabs: ConsoleTab[] = [
  { to: "/app/billing", label: "Billing", hint: "Charge fees for the month and record payments" },
  { to: "/app/verify", label: "Payments to check", hint: "Payments dancers say they made, waiting for you to confirm" },
  { to: "/app/month-end", label: "Month end", hint: "Close the month: billed, collected and still pending" },
  { to: "/app/messages", label: "Messages", hint: "WhatsApp reminders that were queued or sent" },
  { to: "/app/insights", label: "Insights", hint: "Charts of fees and attendance over time" },
];

const studioTabs: ConsoleTab[] = [
  { to: "/app/batches", label: "Batches", hint: "Your classes: when they meet and who is in them" },
  { to: "/app/plans", label: "Fee plans", hint: "The monthly fee amounts you charge" },
  { to: "/app/makeups", label: "Make-ups", hint: "Plan a make-up class for dancers who missed one" },
  { to: "/app/team", label: "Team", hint: "Invite or remove dance teachers" },
  { to: "/account", label: "Account", hint: "Your studio details, plan and due day" },
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
