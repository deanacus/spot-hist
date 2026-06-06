import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  DismissibleWarning,
  RecentPlaysSection,
  SectionHeader,
  StatRow,
  formatDateTime,
  formatPlayCount,
} from '../components/DetailUi';
import { AlbumArt, ArtistArtwork, SpotifyLink } from '../components/Media';
import { Shell, EmptyState, InlineNotice } from '../components/Ui';
import { getErrorMessage } from '../lib/errors';
import {
  isUnauthorizedError,
  queryKeys,
  useArtistDetailQuery,
  useArtistRecentPlaysQuery,
  useBootstrapQuery,
  useRefreshArtistDetailMutation,
} from '../lib/queries';
import { routes } from '../lib/routes';

export function ArtistDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const detailQuery = useArtistDetailQuery(id, Boolean(status));
  const recentPlaysQuery = useArtistRecentPlaysQuery(id, Boolean(status), 5);
  const {
    error: refreshError,
    isPending: isRefreshing,
    mutate: refreshDetail,
    reset: resetRefresh,
  } = useRefreshArtistDetailMutation(id);
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
        setRefreshWarning(getErrorMessage(error, 'Unable to refresh artist detail right now.'));
      },
    });
  }, [detailQuery.data, id, isRefreshing, refreshDetail]);

  const detail = detailQuery.data;
  const error =
    detailQuery.error && !isUnauthorizedError(detailQuery.error)
      ? getErrorMessage(detailQuery.error, 'Unable to load artist detail.')
      : null;
  const imageUrl = detail?.spotify.images[0]?.url ?? null;

  return (
    <Shell>
      {!account ? (
        <EmptyState
          title="Spotify is disconnected"
          body="Reconnect in settings before viewing artist detail."
        />
      ) : !id ? (
        <InlineNotice tone="error">Artist id is missing from the route.</InlineNotice>
      ) : detailQuery.isPending && !detail ? (
        <p className="py-8 text-sm text-(--text-subdued) animate-pulse">Loading artist detail...</p>
      ) : error && !detail ? (
        <InlineNotice tone="error">{error}</InlineNotice>
      ) : detail ? (
        <div className="space-y-6">
          <Link
            to={routes.artists}
            className="inline-flex items-center gap-1.5 text-sm text-(--text-secondary) transition hover:text-(--text-primary)"
          >
            <span aria-hidden="true">←</span>
            Back to artists
          </Link>

          {refreshWarning ? (
            <DismissibleWarning
              message={refreshWarning}
              onDismiss={() => setRefreshWarning(null)}
            />
          ) : null}
          {isRefreshing ? (
            <InlineNotice>Refreshing metadata in the background...</InlineNotice>
          ) : null}

          {/* Hero */}
          <div className="flex items-end gap-6">
            <ArtistArtwork name={detail.artist.name} imageUrl={imageUrl} className="h-48 w-48" />
            <div className="min-w-0 flex-1 space-y-2 pb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-(--text-subdued)">
                Artist
              </p>
              <h1 className="text-5xl font-black tracking-tight">{detail.artist.name}</h1>
              {detail.spotify.genres.length > 0 ? (
                <p className="text-sm text-(--text-secondary)">
                  {detail.spotify.genres.join(', ')}
                </p>
              ) : null}
              <SpotifyLink url={detail.spotify.url} />
            </div>
          </div>

          {/* Stats */}
          <StatRow
            items={[
              { label: 'Rank', value: detail.stats.rank ? `#${detail.stats.rank}` : '—' },
              { label: 'Total plays', value: formatPlayCount(detail.stats.totalPlays) },
              { label: 'Unique tracks', value: detail.stats.uniqueTracks.toLocaleString() },
              { label: 'Unique albums', value: detail.stats.uniqueAlbums.toLocaleString() },
              { label: 'First played', value: formatDateTime(detail.stats.firstPlayedAt) },
              { label: 'Last played', value: formatDateTime(detail.stats.lastPlayedAt) },
            ]}
          />

          {/* Top tracks */}
          <section className="space-y-3">
            <SectionHeader title="Popular" />
            {detail.topTracks.length === 0 ? (
              <p className="text-sm text-(--text-subdued)">No local track rankings yet.</p>
            ) : (
              <div>
                {detail.topTracks.map((item, index) => (
                  <div
                    key={item.track.id}
                    className="group flex items-center gap-3 rounded px-3 py-2 transition-colors hover:bg-(--bg-hover)"
                  >
                    <span className="w-6 text-center text-sm tabular-nums text-(--text-subdued)">
                      {index + 1}
                    </span>
                    <AlbumArt
                      imageUrl={item.album.imageUrl}
                      alt={`${item.album.name} album art`}
                      fallbackLabel="♪"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.track.routeId ? (
                          <Link to={routes.track(item.track.routeId)} className="hover:underline">
                            {item.track.name}
                          </Link>
                        ) : (
                          item.track.name
                        )}
                      </p>
                      <p className="truncate text-xs text-(--text-secondary)">
                        {item.album.routeId ? (
                          <Link to={routes.album(item.album.routeId)} className="hover:underline">
                            {item.album.name}
                          </Link>
                        ) : (
                          item.album.name
                        )}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-(--text-secondary)">
                      {item.playCount.toLocaleString()} plays
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent plays */}
          <RecentPlaysSection
            title="Recent plays"
            description="Most recent plays that included this artist."
            items={recentPlays}
            onLoadMore={() => recentPlaysQuery.fetchNextPage()}
            hasMore={recentPlaysQuery.hasNextPage}
            isLoadingMore={recentPlaysQuery.isFetchingNextPage}
          />

          {/* Discography — merged local albums + catalog */}
          {detail.topAlbums.length > 0 || detail.catalogAlbums.length > 0 ? (
            <section className="space-y-3">
              <SectionHeader title="Discography" />
              <div className="grid gap-x-4 gap-y-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {detail.topAlbums.map((item) => (
                  <div key={item.album.id}>
                    <AlbumArt
                      imageUrl={item.album.imageUrl}
                      alt={`${item.album.name} album art`}
                      fallbackLabel="LP"
                      className="w-full aspect-square"
                    />
                    <p className="mt-2 truncate text-sm font-medium">
                      {item.album.routeId ? (
                        <Link to={routes.album(item.album.routeId)} className="hover:underline">
                          {item.album.name}
                        </Link>
                      ) : (
                        item.album.name
                      )}
                    </p>
                    <p className="text-xs text-(--text-subdued)">
                      {item.playCount.toLocaleString()} plays
                    </p>
                  </div>
                ))}
                {detail.catalogAlbums
                  .filter((album) => !detail.topAlbums.some((ta) => ta.album.id === album.id))
                  .map((album) => (
                    <div key={album.id}>
                      <AlbumArt
                        imageUrl={album.imageUrl}
                        alt={`${album.name} album art`}
                        fallbackLabel="LP"
                        className="w-full aspect-square"
                      />
                      <p className="mt-2 truncate text-sm font-medium">
                        {album.routeId ? (
                          <Link to={routes.album(album.routeId)} className="hover:underline">
                            {album.name}
                          </Link>
                        ) : album.spotifyUrl ? (
                          <a
                            href={album.spotifyUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {album.name}
                          </a>
                        ) : (
                          album.name
                        )}
                      </p>
                      <p className="text-xs text-(--text-subdued)">
                        {album.albumType ?? 'release'} • {album.totalTracks ?? '?'} tracks
                      </p>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </Shell>
  );
}
