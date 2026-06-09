import { Navigate, useParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { Shell, EmptyState } from "../components/Ui";
import { TopTracksList } from "../components/TopLists";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  useTopTracksQuery,
} from "../lib/queries";
import { useInvalidateBootstrapOnUnauthorized, usePageStatus, usePaginatedRouteState } from "../lib/page-state";
import { routes } from "../lib/routes";

const PAGE_SIZE = 50;

export function TopTracksPage() {
  const { page: pageParam } = useParams();
  const { status, account, statsQuery } = usePageStatus();
  const { page, currentPage, offset } = usePaginatedRouteState({
    pageParam,
    pageSize: PAGE_SIZE,
    baseRoute: routes.tracks,
    pageRoute: routes.tracksPage,
  });
  const topTracksQuery = useTopTracksQuery(Boolean(status) && page !== null, PAGE_SIZE, offset);
  useInvalidateBootstrapOnUnauthorized(topTracksQuery.error);
  const { redirectTo } = usePaginatedRouteState({
    pageParam,
    pageSize: PAGE_SIZE,
    baseRoute: routes.tracks,
    pageRoute: routes.tracksPage,
    total: topTracksQuery.data?.total,
  });

  if (redirectTo) {
    return <Navigate replace to={redirectTo} />;
  }

  const error =
    topTracksQuery.error && !isUnauthorizedError(topTracksQuery.error)
      ? getErrorMessage(topTracksQuery.error, "Unable to load top tracks.")
      : null;

  return (
    <Shell
      title="Tracks"
      subtitle={
        statsQuery.data?.uniqueTracks
          ? `${statsQuery.data.uniqueTracks.toLocaleString()} tracks in your library`
          : "Tracks"
      }
    >
      {!account ? (
        <EmptyState
          title="Spotify is disconnected"
          body="Reconnect in settings before viewing track rankings."
        />
      ) : (
        <TopTracksList
          items={topTracksQuery.data?.items ?? []}
          loading={topTracksQuery.isPending}
          error={error}
          offset={offset}
          footer={
            topTracksQuery.data ? (
              <Pagination
                currentPage={currentPage}
                total={topTracksQuery.data.total}
                pageSize={PAGE_SIZE}
                getHref={routes.tracksPage}
              />
            ) : null
          }
        />
      )}
    </Shell>
  );
}
