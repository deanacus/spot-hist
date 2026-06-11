import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { AlbumArt, ArtistArtwork } from "../Media";

function SectionFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function RankedEntityList({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{
    rank: number;
    kind: "artist" | "album" | "track";
    name: string;
    to: string;
    imageUrl: string | null;
    eyebrow: string;
    statLine: string;
  }>;
}) {
  return (
    <SectionFrame title={title} subtitle={subtitle}>
      {items.length === 0 ? (
        <p className="text-sm text-(--text-secondary)">No scrobbles in this period.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={`${item.kind}-${item.rank}-${item.name}`}
              to={item.to}
              className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-white/5 bg-black/10 p-3 transition hover:border-(--border-strong) hover:bg-(--bg-hover)"
            >
              <div className="w-7 text-right text-xs font-semibold text-(--text-subdued)">{item.rank}</div>
              {item.kind === "artist" ? (
                <ArtistArtwork name={item.name} imageUrl={item.imageUrl} className="h-14 w-14 rounded-2xl" />
              ) : (
                <AlbumArt imageUrl={item.imageUrl} alt={`${item.name} artwork`} fallbackLabel={item.name.slice(0, 2)} className="h-14 w-14 rounded-2xl" />
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-(--text-primary)">{item.name}</p>
                <p className="mt-1 truncate text-sm text-(--text-secondary)">{item.eyebrow}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-(--accent-highlight)">
                  {item.statLine}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </SectionFrame>
  );
}
