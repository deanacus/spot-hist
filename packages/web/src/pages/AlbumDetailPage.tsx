import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ArtistsInline,
  DismissibleWarning,
  RecentPlaysSection,
  SectionHeader,
  StatRow,
  formatDate,
  formatDateTime,
  formatPlayCount,
} from '../components/DetailUi';
import { AlbumArt, SpotifyLink } from '../components/Media';
import { Shell, EmptyState, InlineNotice } from '../components/Ui';
import { getErrorMessage } from '../lib/errors';
import {
  isUnauthorizedError,
  queryKeys,
  useAlbumDetailQuery,
  useAlbumRecentPlaysQuery,
  useBootstrapQuery,
  useRefreshAlbumDetailMutation,
} from '../lib/queries';
import { routes } from '../lib/routes';

export function AlbumDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const detailQuery = useAlbumDetailQuery(id, Boolean(status));
  const recentPlaysQuery = useAlbumRecentPlaysQuery(id, Boolean(status), 5);
  const {
    error: refreshError,
    isPending: isRefreshing,
    mutate: refreshDetail,
    reset: resetRefresh,
  } = useRefreshAlbumDetailMutation(id);
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

    if (!id || !detail || detail.detailStatus === 'fresh' || isRefreshing) {
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
        setRefreshWarning(getErrorMessage(error, 'Unable to refresh album detail right now.'));
      },
    });
  }, [detailQuery.data, id, isRefreshing, refreshDetail]);

  const detail = detailQuery.data;
  const error =
    detailQuery.error && !isUnauthorizedError(detailQuery.error)
      ? getErrorMessage(detailQuery.error, 'Unable to load album detail.')
      : null;
  const imageUrl = detail?.spotify.images[0]?.url ?? detail?.album.imageUrl ?? null;

  return (
    <Shell>
      {!account ? (
        <EmptyState
          title="Spotify is disconnected"
          body="Reconnect in settings before viewing album detail."
        />
      ) : !id ? (
        <InlineNotice tone="error">Album id is missing from the route.</InlineNotice>
      ) : detailQuery.isPending && !detail ? (
        <p className="py-8 text-sm text-(--text-subdued) animate-pulse">Loading album detail...</p>
      ) : error && !detail ? (
        <InlineNotice tone="error">{error}</InlineNotice>
      ) : detail ? (
        <div className="space-y-6">
          <Link
            to={routes.albums}
            className="inline-flex items-center gap-1.5 text-sm text-(--text-secondary) transition hover:text-(--text-primary)"
          >
            <span aria-hidden="true">←</span>
            Back to albums
          </Link>

          {refreshWarning ? (
            <DismissibleWarning message={refreshWarning} onDismiss={() => setRefreshWarning(null)} />
          ) : null}
          {isRefreshing ? (
            <InlineNotice>Refreshing album metadata in the background...</InlineNotice>
          ) : null}

          {/* Hero */}
          <div className="flex items-end gap-6">
            <AlbumArt
              imageUrl={imageUrl}
              alt={`${detail.album.name} album art`}
              fallbackLabel="LP"
              className="h-48 w-48 shadow-[0_4px_60px_rgba(0,0,0,0.5)]"
            />
            <div className="min-w-0 flex-1 space-y-2 pb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-(--text-subdued)">
                {detail.album.albumType ?? 'Album'}
              </p>
              <h1 className="text-5xl font-black tracking-tight">{detail.album.name}</h1>
              <p className="text-sm text-(--text-secondary)">
                <ArtistsInline artists={detail.artists} /> • {formatDate(detail.album.releaseDate)} • {detail.album.totalTracks} tracks
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-(--text-secondary)">
                <span>{detail.spotify.label ?? 'Unknown label'}</span>
              </div>
              <SpotifyLink url={detail.spotify.url} />
            </div>
          </div>

          {/* Stats */}
          <StatRow
            items={[
              { label: 'Rank', value: detail.stats.rank ? `#${detail.stats.rank}` : '—' },
              { label: 'Total plays', value: formatPlayCount(detail.stats.totalPlays) },
              { label: 'Played tracks', value: detail.stats.uniquePlayedTracks.toLocaleString() },
              { label: 'First played', value: formatDateTime(detail.stats.firstPlayedAt) },
              { label: 'Last played', value: formatDateTime(detail.stats.lastPlayedAt) },
            ]}
          />

          {/* Tracklist */}
          <section className="space-y-3">
            <SectionHeader title="Tracklist" />
            {detail.tracklist.length === 0 ? (
              <p className="text-sm text-(--text-subdued)">No tracklist cached yet.</p>
            ) : (
              <div>
                <div className="flex items-center gap-3 border-b border-(--border-subtle) px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-(--text-subdued)">
                  <span className="w-8 text-center">#</span>
                  <span className="flex-1">Title</span>
                  <span className="w-20 text-right">Plays</span>
                </div>
                {detail.tracklist.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-3 rounded px-3 py-2 transition-colors hover:bg-(--bg-hover)"
                  >
                    <span className="w-8 text-center text-sm tabular-nums text-(--text-subdued)">
                      {item.trackNumber ?? '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
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
                    <span className="w-20 text-right text-sm tabular-nums text-(--text-secondary)">
                      {item.playCount?.toLocaleString() ?? '0'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent plays */}
          <RecentPlaysSection
            title="Recent plays"
            description="Most recent plays collected for this album."
            items={recentPlays}
            onLoadMore={() => recentPlaysQuery.fetchNextPage()}
            hasMore={recentPlaysQuery.hasNextPage}
            isLoadingMore={recentPlaysQuery.isFetchingNextPage}
          />
        </div>
      ) : null}
    </Shell>
  );
}
