import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shell, EmptyState } from "../components/Ui";
import { TopTracksList } from "../components/TopLists";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
  useStatsQuery,
  useTopTracksQuery,
} from "../lib/queries";

export function TopTracksPage() {
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const statsQuery = useStatsQuery(Boolean(status));
  const topTracksQuery = useTopTracksQuery(Boolean(status));

  useEffect(() => {
    if (isUnauthorizedError(topTracksQuery.error)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [queryClient, topTracksQuery.error]);

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
        />
      )}
    </Shell>
  );
}
