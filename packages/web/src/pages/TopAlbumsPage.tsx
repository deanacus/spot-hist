import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { Shell, EmptyState } from "../components/Ui";
import { TopAlbumsList } from "../components/TopLists";
import { getErrorMessage } from "../lib/errors";
import {
  getPageOffset,
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
  useStatsQuery,
  useTopAlbumsQuery,
} from "../lib/queries";
import { parsePageParam, routes } from "../lib/routes";

const PAGE_SIZE = 50;

export function TopAlbumsPage() {
  const { page: pageParam } = useParams();
  const page = parsePageParam(pageParam);
  const currentPage = page ?? 1;

  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const statsQuery = useStatsQuery(Boolean(status));
  const offset = getPageOffset(currentPage, PAGE_SIZE);
  const topAlbumsQuery = useTopAlbumsQuery(Boolean(status) && page !== null, PAGE_SIZE, offset);

  useEffect(() => {
    if (isUnauthorizedError(topAlbumsQuery.error)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [queryClient, topAlbumsQuery.error]);

  if (page === null) {
    return <Navigate replace to={routes.albums} />;
  }

  if (pageParam !== undefined && currentPage === 1) {
    return <Navigate replace to={routes.albums} />;
  }

  if (topAlbumsQuery.data) {
    const totalPages = Math.max(1, Math.ceil(topAlbumsQuery.data.total / PAGE_SIZE));
    if (currentPage > totalPages) {
      return <Navigate replace to={routes.albumsPage(totalPages)} />;
    }
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
