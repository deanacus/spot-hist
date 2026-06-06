import type { ReactNode } from "react";
import { EmptyState, InlineNotice } from "./Ui";
import { AlbumArt, ArtistArtwork, InternalDetailLink } from "./Media";
import type { TopAlbum, TopArtist, TopTrack } from "../lib/api";
import { routes } from "../lib/routes";

function formatPlayCount(playCount: number) {
  return playCount.toLocaleString();
}

function formatLastPlayed(lastPlayedAt: string | null) {
  if (!lastPlayedAt) return "—";
  return new Date(lastPlayedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ─── Column Header Row ─── */

function ListHeader({ columns }: { columns: string[] }) {
  return (
    <div className="flex items-center gap-3 border-b border-(--border-subtle) px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-(--text-subdued)">
      <span className="w-8 text-center">#</span>
      {columns.map((col) => (
        <span key={col} className={col === "Title" ? "flex-1 min-w-0" : "shrink-0 w-28 text-right"}>
          {col}
        </span>
      ))}
    </div>
  );
}

/* ─── TopListSection ─── */

function TopListSection({
  loading,
  error,
  emptyTitle,
  emptyBody,
  children,
}: {
  loading: boolean;
  error: string | null;
  emptyTitle: string;
  emptyBody: string;
  children: ReactNode;
}) {
  if (loading) {
    return <p className="py-8 text-sm text-(--text-subdued) animate-pulse">Loading...</p>;
  }

  if (error) {
    return <InlineNotice tone="error">{error}</InlineNotice>;
  }

  if (!children) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  return <>{children}</>;
}

/* ─── Top Artists List ─── */

export function TopArtistsList({
  items,
  loading,
  error,
}: {
  items: TopArtist[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <TopListSection
      loading={loading}
      error={error}
      emptyTitle="No artists yet"
      emptyBody="Artists will appear here once the tracker has collected enough listening history."
    >
      {items.length > 0 ? (
        <div>
          <ListHeader columns={["Title", "Plays", "Last played"]} />
          {items.map((item, index) => (
            <div
              key={item.artist.id}
              className="group flex items-center gap-3 rounded px-3 py-2.5 transition-colors hover:bg-(--bg-hover)"
            >
              <span className="w-8 text-center text-sm tabular-nums text-(--text-subdued) group-hover:text-(--text-primary)">
                {index + 1}
              </span>
              <ArtistArtwork name={item.artist.name} imageUrl={item.artist.imageUrl ?? null} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--text-primary)">
                  <InternalDetailLink to={routes.artist(item.artist.id)}>
                    {item.artist.name}
                  </InternalDetailLink>
                </p>
              </div>
              <span className="w-28 text-right text-sm tabular-nums text-(--text-secondary)">
                {formatPlayCount(item.playCount)}
              </span>
              <span className="w-28 text-right text-sm text-(--text-subdued)">
                {formatLastPlayed(item.lastPlayedAt)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </TopListSection>
  );
}

/* ─── Top Albums List ─── */

export function TopAlbumsList({
  items,
  loading,
  error,
}: {
  items: TopAlbum[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <TopListSection
      loading={loading}
      error={error}
      emptyTitle="No albums yet"
      emptyBody="Albums will appear here once the tracker has collected enough listening history."
    >
      {items.length > 0 ? (
        <div>
          <ListHeader columns={["Title", "Plays", "Last played"]} />
          {items.map((item, index) => (
            <div
              key={item.album.id}
              className="group flex items-center gap-3 rounded px-3 py-2.5 transition-colors hover:bg-(--bg-hover)"
            >
              <span className="w-8 text-center text-sm tabular-nums text-(--text-subdued) group-hover:text-(--text-primary)">
                {index + 1}
              </span>
              <AlbumArt
                imageUrl={item.album.imageUrl}
                alt={`${item.album.name} album art`}
                fallbackLabel="LP"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--text-primary)">
                  <InternalDetailLink to={routes.album(item.album.id)}>
                    {item.album.name}
                  </InternalDetailLink>
                </p>
                <p className="truncate text-xs text-(--text-secondary)">
                  {item.artists.map((artist, idx) => (
                    <span key={artist.id}>
                      {idx > 0 ? ", " : null}
                      <InternalDetailLink to={routes.artist(artist.id)}>
                        {artist.name}
                      </InternalDetailLink>
                    </span>
                  ))}
                </p>
              </div>
              <span className="w-28 text-right text-sm tabular-nums text-(--text-secondary)">
                {formatPlayCount(item.playCount)}
              </span>
              <span className="w-28 text-right text-sm text-(--text-subdued)">
                {formatLastPlayed(item.lastPlayedAt)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </TopListSection>
  );
}

/* ─── Top Tracks List ─── */

export function TopTracksList({
  items,
  loading,
  error,
}: {
  items: TopTrack[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <TopListSection
      loading={loading}
      error={error}
      emptyTitle="No tracks yet"
      emptyBody="Tracks will appear here once the tracker has collected enough listening history to rank them."
    >
      {items.length > 0 ? (
        <div>
          <ListHeader columns={["Title", "Plays", "Last played"]} />
          {items.map((item, index) => (
            <div
              key={item.track.id}
              className="group flex items-center gap-3 rounded px-3 py-2.5 transition-colors hover:bg-(--bg-hover)"
            >
              <span className="w-8 text-center text-sm tabular-nums text-(--text-subdued) group-hover:text-(--text-primary)">
                {index + 1}
              </span>
              <AlbumArt
                imageUrl={item.album.imageUrl}
                alt={`${item.album.name} album art`}
                fallbackLabel="♪"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--text-primary)">
                  <InternalDetailLink to={routes.track(item.track.id)}>
                    {item.track.name}
                  </InternalDetailLink>
                </p>
                <p className="truncate text-xs text-(--text-secondary)">
                  {item.artists.map((artist, idx) => (
                    <span key={artist.id}>
                      {idx > 0 ? ", " : null}
                      <InternalDetailLink to={routes.artist(artist.id)}>
                        {artist.name}
                      </InternalDetailLink>
                    </span>
                  ))}{" "}
                  •{" "}
                  <InternalDetailLink to={routes.album(item.album.id)}>
                    {item.album.name}
                  </InternalDetailLink>
                </p>
              </div>
              <span className="w-28 text-right text-sm tabular-nums text-(--text-secondary)">
                {formatPlayCount(item.playCount)}
              </span>
              <span className="w-28 text-right text-sm text-(--text-subdued)">
                {formatLastPlayed(item.lastPlayedAt)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </TopListSection>
  );
}
