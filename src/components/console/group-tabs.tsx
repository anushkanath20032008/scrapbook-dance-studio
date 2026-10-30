import { Link } from "@tanstack/react-router";
import { groupTabs, type GroupId } from "@/lib/console-nav";

// The strip of sibling pages shown above a group's content. Shared by the console layout
// and /account, which lives outside the console layout but belongs to Studio.
export function GroupTabs({
  group,
  pathname,
  messagingConfigured = false,
}: {
  group: GroupId;
  pathname: string;
  messagingConfigured?: boolean;
}) {
  const tabs = groupTabs(group, messagingConfigured);
  if (tabs.length === 0) return null;
  const current = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const label = group === "money" ? "Payment pages" : "Studio pages";
  return (
    <nav className="group-tabs" aria-label={label} data-tour="tabs">
      <ul>
        {tabs.map((tab) => {
          const active = current === tab.to || current.startsWith(`${tab.to}/`);
          return (
            <li key={tab.to}>
              <Link
                to={tab.to}
                title={tab.hint}
                className="group-tab"
                aria-current={active ? "page" : undefined}
                data-active={active ? "true" : undefined}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
