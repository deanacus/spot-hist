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

type DiscographyCardItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  routeId: string | null;
  spotifyUrl: string | null;
  meta: string;
};

function isSingleRelease(albumType: string) {
  return albumType.toLowerCase() === 'single';
}

function buildDiscographyItems(
  detail: NonNullable<ReturnType<typeof useArtistDetailQuery>['data']>,
  releaseType: 'album' | 'single',
): DiscographyCardItem[] {
  const localItems = detail.topAlbums
    .filter((item) => isSingleRelease(item.albumType) === (releaseType === 'single'))
    .map((item) => ({
      id: item.album.id,
      name: item.album.name,
      imageUrl: item.album.imageUrl,
      routeId: item.album.routeId ?? null,
      spotifyUrl: null,
      meta: `${item.playCount.toLocaleString()} scrobbles`,
    }));
  const localIds = new Set(localItems.map((item) => item.id));
  const catalogItems = detail.catalogAlbums
    .filter((album) => isSingleRelease(album.albumType) === (releaseType === 'single'))
    .filter((album) => !localIds.has(album.id))
    .map((album) => ({
      id: album.id,
      name: album.name,
      imageUrl: album.imageUrl,
      routeId: album.routeId,
      spotifyUrl: album.spotifyUrl,
      meta: `${album.albumType} • ${album.totalTracks} tracks`,
    }));

  return [...localItems, ...catalogItems];
}

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
  const albums = detail ? buildDiscographyItems(detail, 'album') : [];
  const singles = detail ? buildDiscographyItems(detail, 'single') : [];

  const renderDiscographySection = (title: 'Albums' | 'Singles', items: DiscographyCardItem[]) => {
    if (items.length === 0) {
      return null;
    }

    const fallbackLabel = title === 'Singles' ? '♪' : 'LP';

    return (
      <section className="space-y-3">
        <SectionHeader title={title} />
        <div className="grid gap-x-4 gap-y-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <div key={item.id}>
              {item.routeId ? (
                <Link
                  to={routes.album(item.routeId)}
                  className="group block rounded transition hover:text-(--text-primary)"
                >
                  <AlbumArt
                    imageUrl={item.imageUrl}
                    alt={`${item.name} album art`}
                    fallbackLabel={fallbackLabel}
                    className="w-full aspect-square"
                  />
                  <p className="mt-2 truncate text-sm font-medium group-hover:underline">
                    {item.name}
                  </p>
                  <p className="text-xs text-(--text-subdued)">{item.meta}</p>
                </Link>
              ) : item.spotifyUrl ? (
                <a
                  href={item.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded transition hover:text-(--text-primary)"
                >
                  <AlbumArt
                    imageUrl={item.imageUrl}
                    alt={`${item.name} album art`}
                    fallbackLabel={fallbackLabel}
                    className="w-full aspect-square"
                  />
                  <p className="mt-2 truncate text-sm font-medium group-hover:underline">
                    {item.name}
                  </p>
                  <p className="text-xs text-(--text-subdued)">{item.meta}</p>
                </a>
              ) : (
                <>
                  <AlbumArt
                    imageUrl={item.imageUrl}
                    alt={`${item.name} album art`}
                    fallbackLabel={fallbackLabel}
                    className="w-full aspect-square"
                  />
                  <p className="mt-2 truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-(--text-subdued)">{item.meta}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  };

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
              { label: 'Total scrobbles', value: formatPlayCount(detail.stats.totalPlays) },
              { label: 'Unique tracks', value: detail.stats.uniqueTracks.toLocaleString() },
              { label: 'Unique albums', value: detail.stats.uniqueAlbums.toLocaleString() },
              { label: 'First scrobbled', value: formatDateTime(detail.stats.firstPlayedAt) },
              { label: 'Last scrobbled', value: formatDateTime(detail.stats.lastPlayedAt) },
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
                      {item.playCount.toLocaleString()} scrobbles
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent scrobbles */}
          <RecentPlaysSection
            title="Recent scrobbles"
            description="Most recent scrobbles that included this artist."
            items={recentPlays}
            action={
              <Link
                to={routes.artistScrobbles(detail.artist.id)}
                className="text-sm font-medium text-(--text-secondary) transition hover:text-(--text-primary)"
              >
                View all
              </Link>
            }
          />

          {renderDiscographySection('Albums', albums)}
          {renderDiscographySection('Singles', singles)}
        </div>
      ) : null}
    </Shell>
  );
}
