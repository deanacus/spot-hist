import { Navigate, useParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { Shell, EmptyState } from "../components/Ui";
import { TopArtistsList } from "../components/TopLists";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  useTopArtistsQuery,
} from "../lib/queries";
import { useInvalidateBootstrapOnUnauthorized, usePageStatus, usePaginatedRouteState } from "../lib/page-state";
import { routes } from "../lib/routes";

const PAGE_SIZE = 50;

export function TopArtistsPage() {
  const { page: pageParam } = useParams();
  const { status, account, statsQuery } = usePageStatus();
  const { page, currentPage, offset } = usePaginatedRouteState({
    pageParam,
    pageSize: PAGE_SIZE,
    baseRoute: routes.artists,
    pageRoute: routes.artistsPage,
  });
  const topArtistsQuery = useTopArtistsQuery(Boolean(status) && page !== null, PAGE_SIZE, offset);
  useInvalidateBootstrapOnUnauthorized(topArtistsQuery.error);
  const { redirectTo } = usePaginatedRouteState({
    pageParam,
    pageSize: PAGE_SIZE,
    baseRoute: routes.artists,
    pageRoute: routes.artistsPage,
    total: topArtistsQuery.data?.total,
  });

  if (redirectTo) {
    return <Navigate replace to={redirectTo} />;
  }

  const error =
    topArtistsQuery.error && !isUnauthorizedError(topArtistsQuery.error)
      ? getErrorMessage(topArtistsQuery.error, "Unable to load top artists.")
      : null;

  return (
    <Shell
      title="Artists"
      subtitle={
        statsQuery.data?.uniqueArtists
          ? `${statsQuery.data.uniqueArtists.toLocaleString()} artists in your library`
          : "Artists"
      }
    >
      {!account ? (
        <EmptyState
          title="Spotify is disconnected"
          body="Reconnect in settings before viewing artist rankings."
        />
      ) : (
        <TopArtistsList
          items={topArtistsQuery.data?.items ?? []}
          loading={topArtistsQuery.isPending}
          error={error}
          offset={offset}
          footer={
            topArtistsQuery.data ? (
              <Pagination
                currentPage={currentPage}
                total={topArtistsQuery.data.total}
                pageSize={PAGE_SIZE}
                getHref={routes.artistsPage}
              />
            ) : null
          }
        />
      )}
    </Shell>
  );
}
