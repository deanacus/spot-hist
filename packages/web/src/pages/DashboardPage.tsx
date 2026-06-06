import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Shell, Button, EmptyState, InlineNotice, MetricCard } from '../components/Ui';
import { AlbumArt } from '../components/Media';
import { getErrorMessage } from '../lib/errors';
import {
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
  useHistoryQuery,
  useStatsQuery,
} from '../lib/queries';
import { routes } from '../lib/routes';

export function DashboardPage() {
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const statsQuery = useStatsQuery(Boolean(status));
  const stats = statsQuery.data ?? null;
  const historyQuery = useHistoryQuery(Boolean(status));

  useEffect(() => {
    if (isUnauthorizedError(historyQuery.error)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [historyQuery.error, queryClient]);

  const account = status?.account ?? null;
  const history = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data],
  );
  const loading = status !== null && historyQuery.isPending;

  const error =
    historyQuery.error && !isUnauthorizedError(historyQuery.error)
      ? getErrorMessage(historyQuery.error, 'Unable to load dashboard data.')
      : null;

  return (
    <Shell title="Listening overview" subtitle="Overview">
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
            label="Total plays"
            value={stats ? stats.totalPlays.toLocaleString() : '0'}
            hint="All-time plays"
          />
        </div>

        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        {/* Recent plays */}
        <section>
          <h2 className="mb-3 text-xl font-bold">Recently played</h2>

          {loading ? (
            <p className="py-8 text-sm text-(--text-subdued) animate-pulse">Loading...</p>
          ) : !account ? (
            <EmptyState
              title="Spotify is disconnected"
              body="Reconnect in settings to resume collection."
            />
          ) : history.length === 0 ? (
            <EmptyState
              title="No plays yet"
              body="The first successful poll will populate this view."
            />
          ) : (
            <div>
              {history.map((item) => (
                <article
                  key={item.id}
                  className="group flex items-center gap-3 rounded px-3 py-2 transition-colors hover:bg-(--bg-hover)"
                >
                  <AlbumArt
                    imageUrl={item.album.imageUrl}
                    alt={`${item.album.name} album art`}
                    fallbackLabel="♪"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-(--text-primary)">
                      <Link
                        to={routes.track(item.track.id)}
                        className="hover:underline"
                      >
                        {item.track.name}
                      </Link>
                    </p>
                    <p className="truncate text-xs text-(--text-secondary)">
                      {item.artists.map((artist, index) => (
                        <span key={artist.id}>
                          {index > 0 ? ', ' : null}
                          <Link
                            to={routes.artist(artist.id)}
                            className="hover:underline"
                          >
                            {artist.name}
                          </Link>
                        </span>
                      ))}{' '}
                      •{' '}
                      <Link
                        to={routes.album(item.album.id)}
                        className="hover:underline"
                      >
                        {item.album.name}
                      </Link>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-(--text-subdued)">
                    {new Date(item.playedAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </article>
              ))}
            </div>
          )}

          {historyQuery.hasNextPage && history.length > 0 ? (
            <div className="mt-4">
              <Button
                kind="secondary"
                size="sm"
                disabled={historyQuery.isFetchingNextPage}
                onClick={() => void historyQuery.fetchNextPage()}
              >
                {historyQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </Shell>
  );
}
