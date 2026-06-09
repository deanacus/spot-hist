import { Link, useParams } from 'react-router-dom';
import {
  DetailPageIntro,
  DetailPageState,
  DismissibleWarning,
  RecentPlaysSection,
  SectionHeader,
  StatRow,
  formatDateTime,
  formatPlayCount,
} from '../components/DetailUi';
import { AlbumArt, ArtistArtwork, SpotifyLink } from '../components/Media';
import { Shell } from '../components/Ui';
import { useDetailRefresh } from '../lib/detail-page';
import { getErrorMessage } from '../lib/errors';
import {
  isUnauthorizedError,
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

function getArtistDetailError(error: unknown) {
  if (!error || isUnauthorizedError(error)) {
    return null;
  }

  return getErrorMessage(error, 'Unable to load artist detail.');
}

function useArtistDetailPageData(id: string | undefined) {
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
  const recentPlays = recentPlaysQuery.data?.items ?? [];
  const { refreshWarning, dismissRefreshWarning } = useDetailRefresh({
    id,
    detail: detailQuery.data,
    detailError: detailQuery.error,
    refreshError,
    isRefreshing,
    resetRefresh,
    refreshErrorMessage: 'Unable to refresh artist detail right now.',
    refresh: ({ onError }) => refreshDetail(undefined, { onError }),
  });

  const detail = detailQuery.data;
  return {
    account,
    detail,
    detailError: getArtistDetailError(detailQuery.error),
    detailLoading: detailQuery.isPending && !detail,
    imageUrl: detail?.spotify.images[0]?.url ?? null,
    isRefreshing,
    refreshWarning,
    dismissRefreshWarning,
    recentPlays,
    albums: detail ? buildDiscographyItems(detail, 'album') : [],
    singles: detail ? buildDiscographyItems(detail, 'single') : [],
  };
}

function DiscographySection(props: { title: 'Albums' | 'Singles'; items: DiscographyCardItem[] }) {
  const { items, title } = props;

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
}

function ArtistPopularTracksSection(props: {
  detail: NonNullable<ReturnType<typeof useArtistDetailPageData>['detail']>;
}) {
  const { detail } = props;

  return (
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
  );
}

function ArtistDetailContent(props: ReturnType<typeof useArtistDetailPageData>) {
  const {
    albums,
    detail,
    dismissRefreshWarning,
    imageUrl,
    isRefreshing,
    recentPlays,
    refreshWarning,
    singles,
  } = props;

  if (!detail) {
    return null;
  }

  return (
    <div className="space-y-6">
      <DetailPageIntro
        backTo={routes.artists}
        backLabel="Back to artists"
        refreshWarning={refreshWarning}
        onDismissRefreshWarning={dismissRefreshWarning}
        isRefreshing={isRefreshing}
        refreshingMessage="Refreshing metadata in the background..."
      />

      <div className="flex items-end gap-6">
        <ArtistArtwork name={detail.artist.name} imageUrl={imageUrl} className="h-48 w-48" />
        <div className="min-w-0 flex-1 space-y-2 pb-1">
          <p className="text-xs font-medium uppercase tracking-wider text-(--text-subdued)">
            Artist
          </p>
          <h1 className="text-5xl font-black tracking-tight">{detail.artist.name}</h1>
          {detail.spotify.genres.length > 0 ? (
            <p className="text-sm text-(--text-secondary)">{detail.spotify.genres.join(', ')}</p>
          ) : null}
          <SpotifyLink url={detail.spotify.url} />
        </div>
      </div>

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

      <ArtistPopularTracksSection detail={detail} />

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

      <DiscographySection title="Albums" items={albums} />
      <DiscographySection title="Singles" items={singles} />
    </div>
  );
}

export function ArtistDetailPage() {
  const { id } = useParams();
  const artistDetailPageData = useArtistDetailPageData(id);

  return (
    <Shell>
      <DetailPageState
        hasAccount={Boolean(artistDetailPageData.account)}
        hasRouteId={Boolean(id)}
        disconnectedBody="Reconnect in settings before viewing artist detail."
        missingIdMessage="Artist id is missing from the route."
        isPending={artistDetailPageData.detailLoading}
        loadingLabel="Loading artist detail..."
        error={!artistDetailPageData.detail ? artistDetailPageData.detailError : null}
      >
        <ArtistDetailContent {...artistDetailPageData} />
      </DetailPageState>
    </Shell>
  );
}
