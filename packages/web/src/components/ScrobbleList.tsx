import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { HistoryItem } from "../lib/api";
import { routes } from "../lib/routes";
import { AlbumArt } from "./Media";
import { EmptyState, InlineNotice } from "./Ui";

function ScrobbleArtists({ artists }: { artists: HistoryItem["artists"] }) {
  return (
    <>
      {artists.map((artist, index) => (
        <span key={artist.id}>
          {index > 0 ? ", " : null}
          <Link to={routes.artist(artist.id)} className="hover:underline">
            {artist.name}
          </Link>
        </span>
      ))}
    </>
  );
}

function formatScrobbledAt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ScrobbleRow({ item }: { item: HistoryItem }) {
  return (
    <article
      className="group flex items-center gap-3 rounded px-3 py-2 transition-colors hover:bg-(--bg-hover)"
    >
      <AlbumArt
        imageUrl={item.album.imageUrl}
        alt={`${item.album.name} album art`}
        fallbackLabel="♪"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-(--text-primary)">
          <Link to={routes.track(item.track.id)} className="hover:underline">
            {item.track.name}
          </Link>
        </p>
        <p className="truncate text-xs text-(--text-secondary)">
          <ScrobbleArtists artists={item.artists} />{" "}
          <span aria-hidden="true">•</span>{" "}
          <Link to={routes.album(item.album.id)} className="hover:underline">
            {item.album.name}
          </Link>
        </p>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-(--text-subdued)">
        {formatScrobbledAt(item.playedAt)}
      </span>
    </article>
  );
}

type ScrobbleListProps = {
  items: HistoryItem[];
  loading: boolean;
  error?: string | null;
  emptyTitle: string;
  emptyBody: string;
  footer?: ReactNode;
};

export function ScrobbleList({
  items,
  loading,
  error = null,
  emptyTitle,
  emptyBody,
  footer,
}: ScrobbleListProps) {
  return (
    <div className="space-y-4">
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {loading ? (
        <p className="py-8 text-sm text-(--text-subdued) animate-pulse">Loading...</p>
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} />
      ) : (
        <>
          <div>
            {items.map((item) => (
              <ScrobbleRow key={item.id} item={item} />
            ))}
          </div>
          {footer ? <div>{footer}</div> : null}
        </>
      )}
    </div>
  );
}
