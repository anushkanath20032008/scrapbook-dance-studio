import { Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarCheck, CalendarDays, ChartLine, ClipboardCheck, GraduationCap, IndianRupee, Repeat, Settings, Tag, Users, type LucideIcon } from "lucide-react";
import type { HomeTile } from "@/lib/console-nav";

// Plain black line icons, so the tiles stay calm and readable.
const icons: Record<string, LucideIcon> = {
  users: Users,
  "indian-rupee": IndianRupee,
  "badge-check": BadgeCheck,
  "clipboard-check": ClipboardCheck,
  "calendar-days": CalendarDays,
  tag: Tag,
  repeat: Repeat,
  "graduation-cap": GraduationCap,
  "calendar-check": CalendarCheck,
  "chart-line": ChartLine,
  settings: Settings,
};

/** Tiles that lead to every screen a role can use. A number on a tile says how much is waiting there. */
export function HomeTiles({
  tiles,
  counts,
  label,
}: {
  tiles: HomeTile[];
  counts: Partial<Record<NonNullable<HomeTile["badge"]>, number>>;
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <ul className="home-tiles">
        {tiles.map((tile, i) => {
          const count = tile.badge ? counts[tile.badge] : undefined;
          return (
            <li key={tile.to}>
              <Link to={tile.to} className="home-tile" data-tone={i % 4} data-waiting={count !== undefined && count > 0}>
                {tile.icon && icons[tile.icon] && (
                  <span className="home-tile-icon" aria-hidden="true">
                    {(() => {
                      const Icon = icons[tile.icon!]!;
                      return <Icon size={34} strokeWidth={1.75} />;
                    })()}
                  </span>
                )}
                <span className="home-tile-title">{tile.label}</span>
                <span className="home-tile-hint">{tile.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
