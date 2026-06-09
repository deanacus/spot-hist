import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Shell, EmptyState, MetricCard } from '../components/Ui';
import { ScrobbleList } from '../components/ScrobbleList';
import { TopAlbumsList, TopArtistsList, TopTracksList } from '../components/TopLists';
import { getErrorMessage } from '../lib/errors';
import {
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
  useHistoryPageQuery,
  useStatsQuery,
  useTopAlbumsQuery,
  useTopArtistsQuery,
  useTopTracksQuery,
} from '../lib/queries';
import { routes } from '../lib/routes';

const HOME_LIMIT = 10;

type HomeStats = {
  totalPlays: number;
  uniqueTracks: number;
  uniqueArtists: number;
  uniqueAlbums: number;
};

function hasUnauthorizedQueryError(...errors: Array<unknown>) {
  return errors.some((error) => isUnauthorizedError(error));
}

function getHomeQueryErrorMessage(error: unknown, fallbackMessage: string) {
  if (!error || isUnauthorizedError(error)) {
    return null;
  }

  return getErrorMessage(error, fallbackMessage);
}

function HomeSection(props: { title: string; href: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold">{props.title}</h2>
        <Link
          to={props.href}
          className="text-sm font-medium text-(--text-secondary) hover:text-(--text-primary)"
        >
          View all
        </Link>
      </div>
      {props.children}
    </section>
  );
}

function HomeStatsGrid(props: { stats: HomeStats | null }) {
  const { stats } = props;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        label="Artists"
        value={stats ? stats.uniqueArtists.toLocaleString() : '0'}
        hint="Unique artists"
        to={routes.artists}
      />
      <MetricCard
        label="Albums"
        value={stats ? stats.uniqueAlbums.toLocaleString() : '0'}
        hint="Unique albums"
        to={routes.albums}
      />
      <MetricCard
        label="Tracks"
        value={stats ? stats.uniqueTracks.toLocaleString() : '0'}
        hint="Unique tracks"
        to={routes.tracks}
      />
      <MetricCard
        label="Total scrobbles"
        value={stats ? stats.totalPlays.toLocaleString() : '0'}
        hint="All-time scrobbles"
      />
    </div>
  );
}

function useHomePageData() {
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const statsQuery = useStatsQuery(Boolean(status));
  const stats = statsQuery.data ?? null;
  const historyQuery = useHistoryPageQuery(Boolean(status), 0, HOME_LIMIT);
  const topArtistsQuery = useTopArtistsQuery(Boolean(status), HOME_LIMIT);
  const topAlbumsQuery = useTopAlbumsQuery(Boolean(status), HOME_LIMIT);
  const topTracksQuery = useTopTracksQuery(Boolean(status), HOME_LIMIT);

  useEffect(() => {
    if (
      hasUnauthorizedQueryError(
        historyQuery.error,
        topArtistsQuery.error,
        topAlbumsQuery.error,
        topTracksQuery.error,
      )
    ) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [
    historyQuery.error,
    queryClient,
    topAlbumsQuery.error,
    topArtistsQuery.error,
    topTracksQuery.error,
  ]);

  const scrobbleError = getHomeQueryErrorMessage(
    historyQuery.error,
    'Unable to load scrobbles.',
  );
  const topArtistsError = getHomeQueryErrorMessage(
    topArtistsQuery.error,
    'Unable to load top artists.',
  );
  const topAlbumsError = getHomeQueryErrorMessage(
    topAlbumsQuery.error,
    'Unable to load top albums.',
  );
  const topTracksError = getHomeQueryErrorMessage(
    topTracksQuery.error,
    'Unable to load top tracks.',
  );

  return {
    account: status?.account ?? null,
    stats,
    historyItems: historyQuery.data?.items ?? [],
    historyLoading: historyQuery.isPending,
    scrobbleError,
    topArtistItems: topArtistsQuery.data?.items ?? [],
    topArtistsLoading: topArtistsQuery.isPending,
    topArtistsError,
    topAlbumItems: topAlbumsQuery.data?.items ?? [],
    topAlbumsLoading: topAlbumsQuery.isPending,
    topAlbumsError,
    topTrackItems: topTracksQuery.data?.items ?? [],
    topTracksLoading: topTracksQuery.isPending,
    topTracksError,
  };
}

function HomeConnectedContent(props: ReturnType<typeof useHomePageData>) {
  if (!props.account) {
    return (
      <EmptyState
        title="Spotify is disconnected"
        body="Reconnect in settings to resume collection."
      />
    );
  }

  return (
    <div className="space-y-8">
      <HomeSection title="Latest scrobbles" href={routes.scrobbles}>
        <ScrobbleList
          items={props.historyItems}
          loading={props.historyLoading}
          error={props.scrobbleError}
          emptyTitle="No scrobbles yet"
          emptyBody="The first successful poll will populate this page."
        />
      </HomeSection>

      <div className="space-y-8">
        <HomeSection title="Top artists" href={routes.artists}>
          <TopArtistsList
            items={props.topArtistItems}
            loading={props.topArtistsLoading}
            error={props.topArtistsError}
          />
        </HomeSection>

        <HomeSection title="Top albums" href={routes.albums}>
          <TopAlbumsList
            items={props.topAlbumItems}
            loading={props.topAlbumsLoading}
            error={props.topAlbumsError}
          />
        </HomeSection>

        <HomeSection title="Top tracks" href={routes.tracks}>
          <TopTracksList
            items={props.topTrackItems}
            loading={props.topTracksLoading}
            error={props.topTracksError}
          />
        </HomeSection>
      </div>
    </div>
  );
}

export function HomePage() {
  const homePageData = useHomePageData();

  return (
    <Shell title="Home" subtitle="Your listening">
      <div className="space-y-8">
        <HomeStatsGrid stats={homePageData.stats} />
        <HomeConnectedContent {...homePageData} />
      </div>
    </Shell>
  );
}
