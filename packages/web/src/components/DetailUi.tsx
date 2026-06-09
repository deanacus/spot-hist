import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  ArtistSummary,
  HistoryItem,
} from "../lib/api";
import { routes } from "../lib/routes";
import { ScrobbleRows } from "./ScrobbleList";
import { Button, EmptyState, InlineNotice } from "./Ui";

function formatCount(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return value.toLocaleString();
}

export function formatPlayCount(value: number | null | undefined) {
  if (value == null) {
    return "0 scrobbles";
  }

  return `${value.toLocaleString()} ${value === 1 ? "scrobble" : "scrobbles"}`;
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1_000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  // Future dates or just now
  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? "hour" : "hours"} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  // Older than a week — show short date
  const sameYear = date.getFullYear() === now.getFullYear();
  if (sameYear) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleDateString();
}

export function formatDuration(durationMs: number | null | undefined) {
  if (durationMs == null) {
    return "—";
  }

  const totalSeconds = Math.floor(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/* ─── Section Header ─── */

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-(--text-secondary)">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* ─── Stat Row ─── Inline horizontal stats ─── */

export function StatRow({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-2xl font-bold">{item.value}</p>
          <p className="text-xs text-(--text-subdued)">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── StatGrid (legacy compat) ─── */

function StatGrid({
  items,
}: {
  items: Array<{ label: string; value: string; hint: string }>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-1 rounded bg-(--bg-elevated) px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">
            {item.label}
          </p>
          <p className="text-xl font-bold">{item.value}</p>
          <p className="text-xs text-(--text-secondary)">{item.hint}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── DismissibleWarning ─── */

export function DismissibleWarning({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <InlineNotice tone="error">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        <Button kind="secondary" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </InlineNotice>
  );
}

export function DetailPageState({
  hasAccount,
  hasRouteId,
  disconnectedBody,
  missingIdMessage,
  isPending,
  loadingLabel,
  error,
  children,
}: {
  hasAccount: boolean;
  hasRouteId: boolean;
  disconnectedBody: string;
  missingIdMessage: string;
  isPending: boolean;
  loadingLabel: string;
  error: string | null;
  children: ReactNode;
}) {
  if (!hasAccount) {
    return (
      <EmptyState title="Spotify is disconnected" body={disconnectedBody} />
    );
  }

  if (!hasRouteId) {
    return <InlineNotice tone="error">{missingIdMessage}</InlineNotice>;
  }

  if (isPending) {
    return (
      <p className="py-8 text-sm text-(--text-subdued) animate-pulse">{loadingLabel}</p>
    );
  }

  if (error) {
    return <InlineNotice tone="error">{error}</InlineNotice>;
  }

  return children;
}

export function DetailPageIntro({
  backTo,
  backLabel,
  refreshWarning,
  onDismissRefreshWarning,
  isRefreshing,
  refreshingMessage,
}: {
  backTo: string;
  backLabel: string;
  refreshWarning: string | null;
  onDismissRefreshWarning: () => void;
  isRefreshing: boolean;
  refreshingMessage: string;
}) {
  return (
    <>
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-(--text-secondary) transition hover:text-(--text-primary)"
      >
        <span aria-hidden="true">←</span>
        {backLabel}
      </Link>

      {refreshWarning ? (
        <DismissibleWarning message={refreshWarning} onDismiss={onDismissRefreshWarning} />
      ) : null}
      {isRefreshing ? <InlineNotice>{refreshingMessage}</InlineNotice> : null}
    </>
  );
}

/* ─── MetadataList ─── Key/value pairs ─── */

function MetadataList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm text-(--text-primary)">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ─── ArtistsInline ─── Comma-separated linked artist names ─── */

export function ArtistsInline({
  artists,
  className = "",
}: {
  artists: ArtistSummary[];
  className?: string;
}) {
  return (
    <span className={className}>
      {artists.map((artist, index) => (
        <span key={artist.id}>
          {index > 0 ? ", " : null}
          <Link
            to={routes.artist(artist.id)}
            className="hover:text-(--text-primary) hover:underline"
          >
            {artist.name}
          </Link>
        </span>
      ))}
    </span>
  );
}

/* ─── RecentPlaysSection ─── Table-like play history ─── */

export function RecentPlaysSection({
  title,
  description,
  items,
  action,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: {
  title: string;
  description: string;
  items: HistoryItem[];
  action?: ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}) {
  return (
    <section className="space-y-4">
      <SectionHeader title={title} description={description} action={action} />
      {items.length === 0 ? (
        <p className="text-sm text-(--text-subdued)">
          No scrobbles have been collected for this view yet.
        </p>
      ) : (
        <>
          <ScrobbleRows items={items} />
          {hasMore && onLoadMore && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="rounded-md px-4 py-2 text-sm font-medium text-(--text-primary) bg-(--bg-secondary) hover:bg-(--bg-hover) disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingMore ? "Loading..." : "Load more scrobbles"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
