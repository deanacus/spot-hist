import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  ArtistsInline,
  DismissibleWarning,
  RecentPlaysSection,
  SectionHeader,
  StatRow,
  formatDateTime,
  formatDuration,
  formatPlayCount,
} from "../components/DetailUi";
import { AlbumArt, SpotifyLink } from "../components/Media";
import { Shell, EmptyState, InlineNotice } from "../components/Ui";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
  useRefreshTrackDetailMutation,
  useTrackDetailQuery,
  useTrackRecentPlaysQuery,
} from "../lib/queries";
import { routes } from "../lib/routes";

export function TrackDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const detailQuery = useTrackDetailQuery(id, Boolean(status));
  const recentPlaysQuery = useTrackRecentPlaysQuery(id, Boolean(status), 5);
  const {
    error: refreshError,
    isPending: isRefreshing,
    mutate: refreshDetail,
    reset: resetRefresh,
  } = useRefreshTrackDetailMutation(id);
  const attemptedRefreshKeyRef = useRef<string | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);

  const recentPlays = recentPlaysQuery.data?.pages.flatMap((page) => page.items) ?? [];

  useEffect(() => {
    attemptedRefreshKeyRef.current = null;
    setRefreshWarning(null);
    resetRefresh();
  }, [id, resetRefresh]);

  useEffect(() => {
    if (isUnauthorizedError(detailQuery.error) || isUnauthorizedError(refreshError)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [detailQuery.error, queryClient, refreshError]);

  useEffect(() => {
    const detail = detailQuery.data;

    if (!id || !detail || detail.detailStatus === "fresh" || isRefreshing) {
      return;
    }

    const refreshKey = `${id}:${detail.detailStatus}`;

    if (attemptedRefreshKeyRef.current === refreshKey) {
      return;
    }

    attemptedRefreshKeyRef.current = refreshKey;
    setRefreshWarning(null);
    refreshDetail(undefined, {
      onError: (error) => {
        setRefreshWarning(getErrorMessage(error, "Unable to refresh track detail right now."));
      },
    });
  }, [detailQuery.data, id, isRefreshing, refreshDetail]);

  const detail = detailQuery.data;
  const error =
    detailQuery.error && !isUnauthorizedError(detailQuery.error)
      ? getErrorMessage(detailQuery.error, "Unable to load track detail.")
      : null;

  return (
    <Shell>
      {!account ? (
        <EmptyState
          title="Spotify is disconnected"
          body="Reconnect in settings before viewing track detail."
        />
      ) : !id ? (
        <InlineNotice tone="error">Track id is missing from the route.</InlineNotice>
      ) : detailQuery.isPending && !detail ? (
        <p className="py-8 text-sm text-(--text-subdued) animate-pulse">Loading track detail...</p>
      ) : error && !detail ? (
        <InlineNotice tone="error">{error}</InlineNotice>
      ) : detail ? (
        <div className="space-y-6">
          <Link
            to={routes.tracks}
            className="inline-flex items-center gap-1.5 text-sm text-(--text-secondary) transition hover:text-(--text-primary)"
          >
            <span aria-hidden="true">←</span>
            Back to tracks
          </Link>

          {refreshWarning ? (
            <DismissibleWarning message={refreshWarning} onDismiss={() => setRefreshWarning(null)} />
          ) : null}
          {isRefreshing ? (
            <InlineNotice>Refreshing track metadata in the background...</InlineNotice>
          ) : null}

          {/* Hero */}
          <div className="flex items-end gap-6">
            <AlbumArt
              imageUrl={detail.album.imageUrl}
              alt={`${detail.album.name} album art`}
              fallbackLabel="♪"
              className="h-48 w-48 shadow-[0_4px_60px_rgba(0,0,0,0.5)]"
            />
            <div className="min-w-0 flex-1 space-y-2 pb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-(--text-subdued)">Song</p>
              <h1 className="text-5xl font-black tracking-tight">{detail.track.name}</h1>
              <p className="text-sm text-(--text-secondary)">
                <ArtistsInline artists={detail.artists} /> •{" "}
                <Link to={routes.album(detail.album.id)} className="hover:underline">
                  {detail.album.name}
                </Link>{" "}
                • {formatDuration(detail.track.durationMs)}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-(--text-secondary)">
                {detail.track.explicit ? (
                  <span className="rounded bg-(--bg-tinted) px-2 py-0.5 text-[10px] font-bold uppercase text-(--text-secondary)">
                    E
                  </span>
                ) : null}
                {detail.track.isrc ? <span className="text-xs text-(--text-subdued)">ISRC {detail.track.isrc}</span> : null}
              </div>
              <SpotifyLink url={detail.spotify.url} />
            </div>
          </div>

          {/* Preview */}
          {detail.spotify.previewUrl ? (
            <audio controls preload="none" src={detail.spotify.previewUrl} className="w-full max-w-md">
              Preview
            </audio>
          ) : null}

          {/* Stats */}
          <StatRow
            items={[
              { label: "Rank", value: detail.stats.rank ? `#${detail.stats.rank}` : "—" },
              { label: "Total plays", value: formatPlayCount(detail.stats.totalPlays) },
              { label: "First played", value: formatDateTime(detail.stats.firstPlayedAt) },
              { label: "Last played", value: formatDateTime(detail.stats.lastPlayedAt) },
              { label: "Duration", value: formatDuration(detail.track.durationMs) },
            ]}
          />

          {/* Recent plays */}
          <RecentPlaysSection
            title="Recent plays"
            description="Most recent plays collected for this track."
            items={recentPlays}
            onLoadMore={() => recentPlaysQuery.fetchNextPage()}
            hasMore={recentPlaysQuery.hasNextPage}
            isLoadingMore={recentPlaysQuery.isFetchingNextPage}
          />

          {/* Album tracklist */}
          <section className="space-y-3">
            <SectionHeader title="Album tracklist" />
            {detail.albumTracklist.length === 0 ? (
              <p className="text-sm text-(--text-subdued)">No tracklist available.</p>
            ) : (
              <div>
                {detail.albumTracklist.map((item) => (
                  <div
                    key={item.id}
                    className={[
                      "group flex items-center gap-3 rounded px-3 py-2 transition-colors",
                      item.isCurrentTrack
                        ? "bg-(--accent-subdued)"
                        : "hover:bg-(--bg-hover)",
                    ].join(" ")}
                  >
                    <span className="w-6 text-center text-sm tabular-nums text-(--text-subdued)">
                      {item.trackNumber ?? "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${item.isCurrentTrack ? "font-bold text-(--accent)" : "font-medium"}`}>
                        {item.routeId ? (
                          <Link to={routes.track(item.routeId)} className="hover:underline">
                            {item.name}
                          </Link>
                        ) : (
                          item.name
                        )}
                      </p>
                      <p className="truncate text-xs text-(--text-secondary)">
                        <ArtistsInline artists={item.artists} />
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-(--text-secondary)">
                      {item.playCount?.toLocaleString() ?? "0"} plays
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </Shell>
  );
}
