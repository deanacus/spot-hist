import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { ScrobbleList } from "../components/ScrobbleList";
import { EmptyState, Shell } from "../components/Ui";
import { getErrorMessage } from "../lib/errors";
import {
  getPageOffset,
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
  useHistoryPageQuery,
  useStatsQuery,
} from "../lib/queries";
import { parsePageParam, routes } from "../lib/routes";

const PAGE_SIZE = 50;

export function ScrobblesPage() {
  const { page: pageParam } = useParams();
  const page = parsePageParam(pageParam);
  const currentPage = page ?? 1;

  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const statsQuery = useStatsQuery(Boolean(status));
  const offset = getPageOffset(currentPage, PAGE_SIZE);
  const scrobblesQuery = useHistoryPageQuery(Boolean(status) && page !== null, offset, PAGE_SIZE);

  useEffect(() => {
    if (isUnauthorizedError(scrobblesQuery.error)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [queryClient, scrobblesQuery.error]);

  const subtitle = useMemo(() => {
    if (!statsQuery.data?.totalPlays) {
      return "Scrobbles";
    }

    return `${statsQuery.data.totalPlays.toLocaleString()} scrobbles collected`;
  }, [statsQuery.data?.totalPlays]);

  if (page === null) {
    return <Navigate replace to={routes.scrobbles} />;
  }

  if (pageParam !== undefined && currentPage === 1) {
    return <Navigate replace to={routes.scrobbles} />;
  }

  if (scrobblesQuery.data) {
    const totalPages = Math.max(1, Math.ceil(scrobblesQuery.data.total / PAGE_SIZE));
    if (currentPage > totalPages) {
      return <Navigate replace to={routes.scrobblesPage(totalPages)} />;
    }
  }

  const error =
    scrobblesQuery.error && !isUnauthorizedError(scrobblesQuery.error)
      ? getErrorMessage(scrobblesQuery.error, "Unable to load scrobbles.")
      : null;

  return (
    <Shell title="Scrobbles" subtitle={subtitle}>
      {!account ? (
        <EmptyState
          title="Spotify is disconnected"
          body="Reconnect in settings before viewing your scrobbles."
        />
      ) : (
        <ScrobbleList
          items={scrobblesQuery.data?.items ?? []}
          loading={scrobblesQuery.isPending}
          error={error}
          emptyTitle="No scrobbles yet"
          emptyBody="Scrobbles will appear here once the tracker collects your listening history."
          footer={
            scrobblesQuery.data ? (
              <Pagination
                currentPage={currentPage}
                total={scrobblesQuery.data.total}
                pageSize={PAGE_SIZE}
                getHref={routes.scrobblesPage}
              />
            ) : null
          }
        />
      )}
    </Shell>
  );
}
