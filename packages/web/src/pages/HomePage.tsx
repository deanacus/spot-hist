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

export function HomePage() {
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const statsQuery = useStatsQuery(Boolean(status));
  const stats = statsQuery.data ?? null;
  const historyQuery = useHistoryPageQuery(Boolean(status), 0, HOME_LIMIT);
  const topArtistsQuery = useTopArtistsQuery(Boolean(status), HOME_LIMIT);
  const topAlbumsQuery = useTopAlbumsQuery(Boolean(status), HOME_LIMIT);
  const topTracksQuery = useTopTracksQuery(Boolean(status), HOME_LIMIT);
  const account = status?.account ?? null;

  useEffect(() => {
    if (
      isUnauthorizedError(historyQuery.error) ||
      isUnauthorizedError(topArtistsQuery.error) ||
      isUnauthorizedError(topAlbumsQuery.error) ||
      isUnauthorizedError(topTracksQuery.error)
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

  const scrobbleError =
    historyQuery.error && !isUnauthorizedError(historyQuery.error)
      ? getErrorMessage(historyQuery.error, 'Unable to load scrobbles.')
      : null;
  const topArtistsError =
    topArtistsQuery.error && !isUnauthorizedError(topArtistsQuery.error)
      ? getErrorMessage(topArtistsQuery.error, 'Unable to load top artists.')
      : null;
  const topAlbumsError =
    topAlbumsQuery.error && !isUnauthorizedError(topAlbumsQuery.error)
      ? getErrorMessage(topAlbumsQuery.error, 'Unable to load top albums.')
      : null;
  const topTracksError =
    topTracksQuery.error && !isUnauthorizedError(topTracksQuery.error)
      ? getErrorMessage(topTracksQuery.error, 'Unable to load top tracks.')
      : null;

  return (
    <Shell title="Home" subtitle="Your listening">
      <div className="space-y-8">
        {/* Stats row */}
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

        {!account ? (
          <EmptyState
            title="Spotify is disconnected"
            body="Reconnect in settings to resume collection."
          />
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-xl font-bold">Latest scrobbles</h2>
                <Link to={routes.scrobbles} className="text-sm font-medium text-(--text-secondary) hover:text-(--text-primary)">
                  View all
                </Link>
              </div>
              <ScrobbleList
                items={historyQuery.data?.items ?? []}
                loading={historyQuery.isPending}
                error={scrobbleError}
                emptyTitle="No scrobbles yet"
                emptyBody="The first successful poll will populate this page."
              />
            </section>

            <div className="space-y-8">
              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="text-xl font-bold">Top artists</h2>
                  <Link to={routes.artists} className="text-sm font-medium text-(--text-secondary) hover:text-(--text-primary)">
                    View all
                  </Link>
                </div>
                <TopArtistsList
                  items={topArtistsQuery.data?.items ?? []}
                  loading={topArtistsQuery.isPending}
                  error={topArtistsError}
                />
              </section>

              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="text-xl font-bold">Top albums</h2>
                  <Link to={routes.albums} className="text-sm font-medium text-(--text-secondary) hover:text-(--text-primary)">
                    View all
                  </Link>
                </div>
                <TopAlbumsList
                  items={topAlbumsQuery.data?.items ?? []}
                  loading={topAlbumsQuery.isPending}
                  error={topAlbumsError}
                />
              </section>

              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="text-xl font-bold">Top tracks</h2>
                  <Link to={routes.tracks} className="text-sm font-medium text-(--text-secondary) hover:text-(--text-primary)">
                    View all
                  </Link>
                </div>
                <TopTracksList
                  items={topTracksQuery.data?.items ?? []}
                  loading={topTracksQuery.isPending}
                  error={topTracksError}
                />
              </section>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
