import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrobbleList } from "../components/ScrobbleList";
import { Button, EmptyState, Shell } from "../components/Ui";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
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
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const currentCursor = cursors[pageIndex] ?? null;
  const scrobblesQuery = useHistoryPageQuery(Boolean(status), currentCursor, PAGE_SIZE);

  useEffect(() => {
    if (isUnauthorizedError(scrobblesQuery.error)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [queryClient, scrobblesQuery.error]);

  useEffect(() => {
    setPageIndex(0);
    setCursors([null]);
  }, [status?.account?.spotifyId]);

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

  const handlePreviousPage = () => {
    if (pageIndex === 0) {
      return;
    }

    setPageIndex((currentPageIndex) => currentPageIndex - 1);
  };

  const handleNextPage = () => {
    const nextCursor = scrobblesQuery.data?.nextCursor;

    if (!nextCursor) {
      return;
    }

    setCursors((currentCursors) => {
      if (currentCursors[pageIndex + 1] === nextCursor) {
        return currentCursors;
      }

      return [...currentCursors.slice(0, pageIndex + 1), nextCursor];
    });
    setPageIndex((currentPageIndex) => currentPageIndex + 1);
  };

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
                onClick={handlePreviousPage}
                disabled={pageIndex === 0 || scrobblesQuery.isPending}
              >
                Previous
              </Button>
              <span className="text-xs font-medium text-(--text-subdued)">
                Page {pageIndex + 1}
              </span>
              <Button
                kind="secondary"
                size="sm"
                onClick={handleNextPage}
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
