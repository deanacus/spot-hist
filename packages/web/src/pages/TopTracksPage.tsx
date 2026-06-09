import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { Shell, EmptyState } from "../components/Ui";
import { TopTracksList } from "../components/TopLists";
import { getErrorMessage } from "../lib/errors";
import {
  getPageOffset,
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
  useStatsQuery,
  useTopTracksQuery,
} from "../lib/queries";
import { parsePageParam, routes } from "../lib/routes";

const PAGE_SIZE = 50;

export function TopTracksPage() {
  const { page: pageParam } = useParams();
  const page = parsePageParam(pageParam);
  const currentPage = page ?? 1;

  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const statsQuery = useStatsQuery(Boolean(status));
  const offset = getPageOffset(currentPage, PAGE_SIZE);
  const topTracksQuery = useTopTracksQuery(Boolean(status) && page !== null, PAGE_SIZE, offset);

  useEffect(() => {
    if (isUnauthorizedError(topTracksQuery.error)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [queryClient, topTracksQuery.error]);

  if (page === null) {
    return <Navigate replace to={routes.tracks} />;
  }

  if (pageParam !== undefined && currentPage === 1) {
    return <Navigate replace to={routes.tracks} />;
  }

  if (topTracksQuery.data) {
    const totalPages = Math.max(1, Math.ceil(topTracksQuery.data.total / PAGE_SIZE));
    if (currentPage > totalPages) {
      return <Navigate replace to={routes.tracksPage(totalPages)} />;
    }
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
