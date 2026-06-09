import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  api,
  type AlbumDetailPage,
  type ArtistDetailPage,
  type TrackDetailPage,
} from "../api";
import { queryKeys } from "./common";

export function useArtistDetailQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.artistDetail(id ?? ""),
    queryFn: () => api.getArtistDetail(id ?? ""),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  });
}

export function useAlbumDetailQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.albumDetail(id ?? ""),
    queryFn: () => api.getAlbumDetail(id ?? ""),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  });
}

export function useTrackDetailQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.trackDetail(id ?? ""),
    queryFn: () => api.getTrackDetail(id ?? ""),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  });
}

export function useArtistRecentPlaysQuery(id: string | undefined, enabled: boolean, limit = 20) {
  return useQuery({
    queryKey: queryKeys.artistRecentPlaysPage(id ?? "", limit, 0),
    queryFn: () => api.getArtistRecentPlays(id ?? "", 0, limit),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  });
}

export function useAlbumRecentPlaysQuery(id: string | undefined, enabled: boolean, limit = 20) {
  return useQuery({
    queryKey: queryKeys.albumRecentPlaysPage(id ?? "", limit, 0),
    queryFn: () => api.getAlbumRecentPlays(id ?? "", 0, limit),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  });
}

export function useTrackRecentPlaysQuery(id: string | undefined, enabled: boolean, limit = 20) {
  return useQuery({
    queryKey: queryKeys.trackRecentPlaysPage(id ?? "", limit, 0),
    queryFn: () => api.getTrackRecentPlays(id ?? "", 0, limit),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  });
}

function makeDetailRefreshMutation<TData extends ArtistDetailPage | AlbumDetailPage | TrackDetailPage>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  mutationFn: () => Promise<TData>,
) {
  return useMutation({
    mutationFn,
    onSuccess: async (data) => {
      queryClient.setQueryData(queryKey, data);
      await queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useRefreshArtistDetailMutation(id: string | undefined) {
  const queryClient = useQueryClient();

  return makeDetailRefreshMutation(
    queryClient,
    queryKeys.artistDetail(id ?? ""),
    () => api.refreshArtistDetail(id ?? ""),
  );
}

export function useRefreshAlbumDetailMutation(id: string | undefined) {
  const queryClient = useQueryClient();

  return makeDetailRefreshMutation(
    queryClient,
    queryKeys.albumDetail(id ?? ""),
    () => api.refreshAlbumDetail(id ?? ""),
  );
}

export function useRefreshTrackDetailMutation(id: string | undefined) {
  const queryClient = useQueryClient();

  return makeDetailRefreshMutation(
    queryClient,
    queryKeys.trackDetail(id ?? ""),
    () => api.refreshTrackDetail(id ?? ""),
  );
}
