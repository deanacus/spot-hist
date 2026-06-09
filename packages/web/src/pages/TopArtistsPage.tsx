import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { Shell, EmptyState } from "../components/Ui";
import { TopArtistsList } from "../components/TopLists";
import { getErrorMessage } from "../lib/errors";
import {
  getPageOffset,
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
  useStatsQuery,
  useTopArtistsQuery,
} from "../lib/queries";
import { parsePageParam, routes } from "../lib/routes";

const PAGE_SIZE = 50;

export function TopArtistsPage() {
  const { page: pageParam } = useParams();
  const page = parsePageParam(pageParam);
  const currentPage = page ?? 1;

  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const statsQuery = useStatsQuery(Boolean(status));
  const offset = getPageOffset(currentPage, PAGE_SIZE);
  const topArtistsQuery = useTopArtistsQuery(Boolean(status) && page !== null, PAGE_SIZE, offset);

  useEffect(() => {
    if (isUnauthorizedError(topArtistsQuery.error)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [queryClient, topArtistsQuery.error]);

  if (page === null) {
    return <Navigate replace to={routes.artists} />;
  }

  if (pageParam !== undefined && currentPage === 1) {
    return <Navigate replace to={routes.artists} />;
  }

  if (topArtistsQuery.data) {
    const totalPages = Math.max(1, Math.ceil(topArtistsQuery.data.total / PAGE_SIZE));
    if (currentPage > totalPages) {
      return <Navigate replace to={routes.artistsPage(totalPages)} />;
    }
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
