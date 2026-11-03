import { Link } from "@tanstack/react-router";
import type { HomeTile } from "@/lib/console-nav";

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
                {tile.icon && (
                  <span className="home-tile-icon" aria-hidden="true">
                    {tile.icon}
                  </span>
                )}
                <span className="home-tile-title">{tile.label}</span>
                {count !== undefined && count > 0 && (
                  <span className="home-tile-badge" aria-label={`${count} waiting`}>
                    {count}
                  </span>
                )}
                <span className="home-tile-hint">{tile.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
