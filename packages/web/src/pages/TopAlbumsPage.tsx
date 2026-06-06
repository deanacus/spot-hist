import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shell, EmptyState } from "../components/Ui";
import { TopAlbumsList } from "../components/TopLists";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
  useStatsQuery,
  useTopAlbumsQuery,
} from "../lib/queries";

export function TopAlbumsPage() {
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const statsQuery = useStatsQuery(Boolean(status));
  const topAlbumsQuery = useTopAlbumsQuery(Boolean(status));

  useEffect(() => {
    if (isUnauthorizedError(topAlbumsQuery.error)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [queryClient, topAlbumsQuery.error]);

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
        />
      )}
    </Shell>
  );
}
