import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shell, EmptyState } from "../components/Ui";
import { TopArtistsList } from "../components/TopLists";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  queryKeys,
  useBootstrapQuery,
  useStatsQuery,
  useTopArtistsQuery,
} from "../lib/queries";

export function TopArtistsPage() {
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const statsQuery = useStatsQuery(Boolean(status));
  const topArtistsQuery = useTopArtistsQuery(Boolean(status));

  useEffect(() => {
    if (isUnauthorizedError(topArtistsQuery.error)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [queryClient, topArtistsQuery.error]);

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
        />
      )}
    </Shell>
  );
}
