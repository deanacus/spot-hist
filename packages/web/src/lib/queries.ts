import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import {
  api,
  ApiError,
  type AppStatus,
  type AlbumDetailPage,
  type ArtistDetailPage,
  type HistoryPage,
  type SetupStatus,
  type SpotifyHistoryImportJob,
  type SpotifyHistoryImportJobStatus,
  type TrackDetailPage,
} from "./api";
import { routes } from "./routes";

export type BootstrapData = {
  setupStatus: SetupStatus;
  appStatus: AppStatus | null;
};

export const queryKeys = {
  bootstrap: ["bootstrap"] as const,
  stats: ["stats"] as const,
  history: ["history"] as const,
  spotifyHistoryImportLatest: ["spotify-history-import", "latest"] as const,
  spotifyHistoryImportJob: (id: string) => ["spotify-history-import", id] as const,
  historyPage: (limit: number, offset: number) => ["history", limit, offset] as const,
  topArtists: (limit: number, offset: number) => ["top-artists", limit, offset] as const,
  topAlbums: (limit: number, offset: number) => ["top-albums", limit, offset] as const,
  topTracks: (limit: number, offset: number) => ["top-tracks", limit, offset] as const,
  artistDetail: (id: string) => ["artist-detail", id] as const,
  albumDetail: (id: string) => ["album-detail", id] as const,
  trackDetail: (id: string) => ["track-detail", id] as const,
  artistRecentPlaysPage: (id: string, limit: number, offset: number) =>
    ["artist-recent-plays", id, limit, offset] as const,
  albumRecentPlaysPage: (id: string, limit: number, offset: number) =>
    ["album-recent-plays", id, limit, offset] as const,
  trackRecentPlaysPage: (id: string, limit: number, offset: number) =>
    ["track-recent-plays", id, limit, offset] as const,
};

const SPOTIFY_HISTORY_IMPORT_POLL_INTERVAL_MS = 2_000;

function isActiveSpotifyHistoryImportJobStatus(status: SpotifyHistoryImportJobStatus | null | undefined) {
  return status === "queued" || status === "running";
}

export function isActiveSpotifyHistoryImportJob(job: SpotifyHistoryImportJob | null | undefined) {
  return isActiveSpotifyHistoryImportJobStatus(job?.status);
}

export type ScrobbleScope =
  | { kind: "all" }
  | { kind: "artist"; id: string }
  | { kind: "album"; id: string }
  | { kind: "track"; id: string };

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

async function fetchBootstrap(): Promise<BootstrapData> {
  const setupStatus = await api.getSetupStatus();

  if (!setupStatus.setupComplete || !setupStatus.spotifyConnected || !setupStatus.passwordSet) {
    return {
      setupStatus,
      appStatus: null,
    };
  }

  try {
    return {
      setupStatus,
      appStatus: await api.getStatus(),
    };
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return {
        setupStatus,
        appStatus: null,
      };
    }

    throw error;
  }
}

export function getHomeRoute(data: BootstrapData) {
  if (!data.setupStatus.passwordSet || !data.setupStatus.spotifyConnected || !data.setupStatus.setupComplete) {
    return routes.setup;
  }

  if (!data.appStatus) {
    return routes.login;
  }

  return routes.home;
}

async function invalidateAuthenticatedQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap }),
    invalidatePlayDerivedQueries(queryClient),
    queryClient.invalidateQueries({ queryKey: queryKeys.spotifyHistoryImportLatest }),
  ]);
}

async function invalidatePlayDerivedQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.stats }),
    queryClient.invalidateQueries({ queryKey: queryKeys.history }),
    queryClient.invalidateQueries({ queryKey: ["top-artists"] }),
    queryClient.invalidateQueries({ queryKey: ["top-albums"] }),
    queryClient.invalidateQueries({ queryKey: ["top-tracks"] }),
    queryClient.invalidateQueries({ queryKey: ["artist-detail"] }),
    queryClient.invalidateQueries({ queryKey: ["album-detail"] }),
    queryClient.invalidateQueries({ queryKey: ["track-detail"] }),
    queryClient.invalidateQueries({ queryKey: ["artist-recent-plays"] }),
    queryClient.invalidateQueries({ queryKey: ["album-recent-plays"] }),
    queryClient.invalidateQueries({ queryKey: ["track-recent-plays"] }),
  ]);
}

export function getPageOffset(page: number, limit: number) {
  return Math.max(page - 1, 0) * limit;
}

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

export function useBootstrapQuery() {
  return useQuery({
    queryKey: queryKeys.bootstrap,
    queryFn: fetchBootstrap,
    staleTime: 15_000,
  });
}

export function useStatsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => api.getStats(),
    enabled,
    staleTime: 15_000,
  });
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

export function useCreatePasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (password: string) => api.createPassword(password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    },
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (password: string) => api.createSession(password),
    onSuccess: async () => {
      await invalidateAuthenticatedQueries(queryClient);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: async () => {
      await invalidateAuthenticatedQueries(queryClient);
    },
  });
}

export function useDisconnectAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.disconnectAccount(),
    onSuccess: async () => {
      await invalidateAuthenticatedQueries(queryClient);
    },
  });
}

export function useDeleteHistoryItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) => api.deleteHistoryItem(id),
    retry: false,
    onSuccess: async () => {
      await invalidatePlayDerivedQueries(queryClient);
    },
  });
}

function useLatestSpotifyHistoryImportJobQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.spotifyHistoryImportLatest,
    queryFn: () => api.getLatestSpotifyHistoryImportJob(),
    enabled,
    staleTime: 0,
  });
}

function useSpotifyHistoryImportJobQuery(id: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.spotifyHistoryImportJob(id ?? ""),
    queryFn: () => api.getSpotifyHistoryImportJob(id ?? ""),
    enabled: enabled && Boolean(id),
    staleTime: 0,
    refetchInterval: (query) =>
      isActiveSpotifyHistoryImportJob(query.state.data as SpotifyHistoryImportJob | undefined)
        ? SPOTIFY_HISTORY_IMPORT_POLL_INTERVAL_MS
        : false,
  });
}

export function useTrackedSpotifyHistoryImportJobQuery(enabled: boolean, preferredJobId?: string | null) {
  const queryClient = useQueryClient();
  const latestJobQuery = useLatestSpotifyHistoryImportJobQuery(enabled);
  const currentJobId = preferredJobId ?? latestJobQuery.data?.id ?? null;
  const jobQuery = useSpotifyHistoryImportJobQuery(currentJobId, enabled && Boolean(currentJobId));
  const job = jobQuery.data ?? latestJobQuery.data ?? null;
  const lastObservedStatusRef = useRef<SpotifyHistoryImportJobStatus | null>(null);

  useEffect(() => {
    const nextStatus = job?.status ?? null;
    const lastObservedStatus = lastObservedStatusRef.current;

    if (isActiveSpotifyHistoryImportJobStatus(lastObservedStatus) && nextStatus === "completed") {
      void invalidateAuthenticatedQueries(queryClient);
    }

    lastObservedStatusRef.current = nextStatus;
  }, [job?.status, queryClient]);

  return {
    latestJobQuery,
    jobQuery,
    job,
  };
}

export function useStartSpotifyHistoryImportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files: File[]) => api.startSpotifyHistoryImport(files),
    onSuccess: async (job) => {
      queryClient.setQueryData(queryKeys.spotifyHistoryImportLatest, job);
      queryClient.setQueryData(queryKeys.spotifyHistoryImportJob(job.id), job);
      return job;
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
