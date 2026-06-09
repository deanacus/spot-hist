import { useQuery } from "@tanstack/react-query";

import { api, type HistoryPage } from "../api";
import { queryKeys, type ScrobbleScope } from "./common";

function getScopedHistoryQueryKey(scope: ScrobbleScope, limit: number, offset: number) {
  switch (scope.kind) {
    case "all":
      return queryKeys.historyPage(limit, offset);
    case "artist":
      return queryKeys.artistRecentPlaysPage(scope.id, limit, offset);
    case "album":
      return queryKeys.albumRecentPlaysPage(scope.id, limit, offset);
    case "track":
      return queryKeys.trackRecentPlaysPage(scope.id, limit, offset);
  }
}

async function fetchScopedHistoryPage(
  scope: ScrobbleScope,
  offset: number,
  limit: number,
): Promise<HistoryPage> {
  switch (scope.kind) {
    case "all":
      return api.getHistory(offset, limit);
    case "artist":
      return api.getArtistRecentPlays(scope.id, offset, limit);
    case "album":
      return api.getAlbumRecentPlays(scope.id, offset, limit);
    case "track":
      return api.getTrackRecentPlays(scope.id, offset, limit);
  }
}

export function useHistoryPageQuery(enabled: boolean, offset = 0, limit = 25) {
  return useScopedHistoryPageQuery(enabled, { kind: "all" }, offset, limit);
}

export function useScopedHistoryPageQuery(
  enabled: boolean,
  scope: ScrobbleScope,
  offset = 0,
  limit = 25,
) {
  return useQuery({
    queryKey: getScopedHistoryQueryKey(scope, limit, offset),
    queryFn: () => fetchScopedHistoryPage(scope, offset, limit),
    enabled: enabled && (scope.kind === "all" || Boolean(scope.id)),
    staleTime: 15_000,
  });
}
