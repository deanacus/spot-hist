import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrobbleList } from "../components/ScrobbleList";
import { Button, EmptyState, Shell } from "../components/Ui";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
  useCursorPageState,
  useHistoryPageQuery,
  useStatsQuery,
} from "../lib/queries";

const PAGE_SIZE = 50;

export function ScrobblesPage() {
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const statsQuery = useStatsQuery(Boolean(status));
  const pagination = useCursorPageState(status?.account?.spotifyId ?? null);
  const scrobblesQuery = useHistoryPageQuery(Boolean(status), pagination.currentCursor, PAGE_SIZE);

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
            <div className="flex items-center justify-between gap-3">
              <Button
                kind="secondary"
                size="sm"
                onClick={pagination.goPrevious}
                disabled={!pagination.canGoPrevious || scrobblesQuery.isPending}
              >
                Previous
              </Button>
              <span className="text-xs font-medium text-(--text-subdued)">
                Page {pagination.pageIndex + 1}
              </span>
              <Button
                kind="secondary"
                size="sm"
                onClick={() => pagination.goNext(scrobblesQuery.data?.nextCursor)}
                disabled={!scrobblesQuery.data?.nextCursor || scrobblesQuery.isPending}
              >
                Next
              </Button>
            </div>
          }
        />
      )}
    </Shell>
  );
}
