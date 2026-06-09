import { Navigate, useParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { Shell, EmptyState } from "../components/Ui";
import { TopAlbumsList } from "../components/TopLists";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  useTopAlbumsQuery,
} from "../lib/queries";
import { useInvalidateBootstrapOnUnauthorized, usePageStatus, usePaginatedRouteState } from "../lib/page-state";
import { routes } from "../lib/routes";

const PAGE_SIZE = 50;

export function TopAlbumsPage() {
  const { page: pageParam } = useParams();
  const { status, account, statsQuery } = usePageStatus();
  const { page, currentPage, offset } = usePaginatedRouteState({
    pageParam,
    pageSize: PAGE_SIZE,
    baseRoute: routes.albums,
    pageRoute: routes.albumsPage,
  });
  const topAlbumsQuery = useTopAlbumsQuery(Boolean(status) && page !== null, PAGE_SIZE, offset);
  useInvalidateBootstrapOnUnauthorized(topAlbumsQuery.error);
  const { redirectTo } = usePaginatedRouteState({
    pageParam,
    pageSize: PAGE_SIZE,
    baseRoute: routes.albums,
    pageRoute: routes.albumsPage,
    total: topAlbumsQuery.data?.total,
  });

  if (redirectTo) {
    return <Navigate replace to={redirectTo} />;
  }

  const error =
    topAlbumsQuery.error && !isUnauthorizedError(topAlbumsQuery.error)
      ? getErrorMessage(topAlbumsQuery.error, "Unable to load top albums.")
      : null;

  return (
    <Shell
      title="Albums"
      subtitle={
        statsQuery.data?.uniqueAlbums
          ? `${statsQuery.data.uniqueAlbums.toLocaleString()} albums in your library`
          : "Albums"
      }
    >
      {!account ? (
        <EmptyState
          title="Spotify is disconnected"
          body="Reconnect in settings before viewing album rankings."
        />
      ) : (
        <TopAlbumsList
          items={topAlbumsQuery.data?.items ?? []}
          loading={topAlbumsQuery.isPending}
          error={error}
          offset={offset}
          footer={
            topAlbumsQuery.data ? (
              <Pagination
                currentPage={currentPage}
                total={topAlbumsQuery.data.total}
                pageSize={PAGE_SIZE}
                getHref={routes.albumsPage}
              />
            ) : null
          }
        />
      )}
    </Shell>
  );
}
