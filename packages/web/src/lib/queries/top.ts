import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { queryKeys } from "./common";

export function useTopArtistsQuery(enabled: boolean, limit = 50, offset = 0) {
  return useQuery({
    queryKey: queryKeys.topArtists(limit, offset),
    queryFn: () => api.getTopArtists(limit, offset),
    enabled,
    staleTime: 15_000,
  });
}

export function useTopAlbumsQuery(enabled: boolean, limit = 50, offset = 0) {
  return useQuery({
    queryKey: queryKeys.topAlbums(limit, offset),
    queryFn: () => api.getTopAlbums(limit, offset),
    enabled,
    staleTime: 15_000,
  });
}

export function useTopTracksQuery(enabled: boolean, limit = 50, offset = 0) {
  return useQuery({
    queryKey: queryKeys.topTracks(limit, offset),
    queryFn: () => api.getTopTracks(limit, offset),
    enabled,
    staleTime: 15_000,
  });
}
