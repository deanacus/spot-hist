import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Pagination } from "../components/Pagination";
import { ScrobbleList } from "../components/ScrobbleList";
import { EmptyState, Shell } from "../components/Ui";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  useHistoryPageQuery,
} from "../lib/queries";
import { useInvalidateBootstrapOnUnauthorized, usePageStatus, usePaginatedRouteState } from "../lib/page-state";
import { routes } from "../lib/routes";

const PAGE_SIZE = 50;

export function ScrobblesPage() {
  const { page: pageParam } = useParams();
  const { status, account, statsQuery } = usePageStatus();
  const { page, currentPage, offset } = usePaginatedRouteState({
    pageParam,
    pageSize: PAGE_SIZE,
    baseRoute: routes.scrobbles,
    pageRoute: routes.scrobblesPage,
  });
  const scrobblesQuery = useHistoryPageQuery(Boolean(status) && page !== null, offset, PAGE_SIZE);
  useInvalidateBootstrapOnUnauthorized(scrobblesQuery.error);
  const { redirectTo } = usePaginatedRouteState({
    pageParam,
    pageSize: PAGE_SIZE,
    baseRoute: routes.scrobbles,
    pageRoute: routes.scrobblesPage,
    total: scrobblesQuery.data?.total,
  });

  const subtitle = useMemo(() => {
    if (!statsQuery.data?.totalPlays) {
      return "Scrobbles";
    }

    return `${statsQuery.data.totalPlays.toLocaleString()} scrobbles collected`;
  }, [statsQuery.data?.totalPlays]);

  if (redirectTo) {
    return <Navigate replace to={redirectTo} />;
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
