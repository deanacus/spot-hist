import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  api,
  ApiError,
  type AppStatus,
  type AlbumDetailPage,
  type ArtistDetailPage,
  type HistoryPage,
  type SetupStatus,
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
  historyPage: (limit: number, cursor: string | null) => ["history", limit, cursor] as const,
  topArtists: (limit: number) => ["top-artists", limit] as const,
  topAlbums: (limit: number) => ["top-albums", limit] as const,
  topTracks: (limit: number) => ["top-tracks", limit] as const,
  artistDetail: (id: string) => ["artist-detail", id] as const,
  albumDetail: (id: string) => ["album-detail", id] as const,
  trackDetail: (id: string) => ["track-detail", id] as const,
  artistRecentPlays: (id: string, limit: number) => ["artist-recent-plays", id, limit] as const,
  artistRecentPlaysPage: (id: string, limit: number, cursor: string | null) =>
    ["artist-recent-plays", id, limit, cursor] as const,
  albumRecentPlays: (id: string, limit: number) => ["album-recent-plays", id, limit] as const,
  albumRecentPlaysPage: (id: string, limit: number, cursor: string | null) =>
    ["album-recent-plays", id, limit, cursor] as const,
  trackRecentPlays: (id: string, limit: number) => ["track-recent-plays", id, limit] as const,
  trackRecentPlaysPage: (id: string, limit: number, cursor: string | null) =>
    ["track-recent-plays", id, limit, cursor] as const,
};

export type ScrobbleScope =
  | { kind: "all" }
  | { kind: "artist"; id: string }
  | { kind: "album"; id: string }
  | { kind: "track"; id: string };

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export async function fetchBootstrap(): Promise<BootstrapData> {
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

function getScopedHistoryQueryKey(scope: ScrobbleScope, limit: number, cursor: string | null) {
  switch (scope.kind) {
    case "all":
      return queryKeys.historyPage(limit, cursor);
    case "artist":
      return queryKeys.artistRecentPlaysPage(scope.id, limit, cursor);
    case "album":
      return queryKeys.albumRecentPlaysPage(scope.id, limit, cursor);
    case "track":
      return queryKeys.trackRecentPlaysPage(scope.id, limit, cursor);
  }
}

async function fetchScopedHistoryPage(
  scope: ScrobbleScope,
  cursor: string | null,
  limit: number,
): Promise<HistoryPage> {
  switch (scope.kind) {
    case "all":
      return api.getHistory(cursor, limit);
    case "artist":
      return api.getArtistRecentPlays(scope.id, cursor, limit);
    case "album":
      return api.getAlbumRecentPlays(scope.id, cursor, limit);
    case "track":
      return api.getTrackRecentPlays(scope.id, cursor, limit);
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

export function useHistoryPageQuery(enabled: boolean, cursor: string | null, limit = 25) {
  return useScopedHistoryPageQuery(enabled, { kind: "all" }, cursor, limit);
}

export function useScopedHistoryPageQuery(
  enabled: boolean,
  scope: ScrobbleScope,
  cursor: string | null,
  limit = 25,
) {
  return useQuery({
    queryKey: getScopedHistoryQueryKey(scope, limit, cursor),
    queryFn: () => fetchScopedHistoryPage(scope, cursor, limit),
    enabled: enabled && (scope.kind === "all" || Boolean(scope.id)),
    staleTime: 15_000,
  });
}

export function useCursorPageState(resetKey: string | null | undefined) {
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const currentCursor = cursors[pageIndex] ?? null;

  useEffect(() => {
    setPageIndex(0);
    setCursors([null]);
  }, [resetKey]);

  const goPrevious = () => {
    setPageIndex((currentPageIndex) => (currentPageIndex > 0 ? currentPageIndex - 1 : currentPageIndex));
  };

  const goNext = (nextCursor: string | null | undefined) => {
    if (!nextCursor) {
      return;
    }

    setPageIndex((currentPageIndex) => {
      setCursors((currentCursors) => {
        if (currentCursors[currentPageIndex + 1] === nextCursor) {
          return currentCursors;
        }

        return [...currentCursors.slice(0, currentPageIndex + 1), nextCursor];
      });

      return currentPageIndex + 1;
    });
  };

  return {
    pageIndex,
    currentCursor,
    canGoPrevious: pageIndex > 0,
    goPrevious,
    goNext,
  };
}

export function useTopArtistsQuery(enabled: boolean, limit = 50) {
  return useQuery({
    queryKey: queryKeys.topArtists(limit),
    queryFn: () => api.getTopArtists(limit),
    enabled,
    staleTime: 15_000,
  });
}

export function useTopAlbumsQuery(enabled: boolean, limit = 50) {
  return useQuery({
    queryKey: queryKeys.topAlbums(limit),
    queryFn: () => api.getTopAlbums(limit),
    enabled,
    staleTime: 15_000,
  });
}

export function useTopTracksQuery(enabled: boolean, limit = 50) {
  return useQuery({
    queryKey: queryKeys.topTracks(limit),
    queryFn: () => api.getTopTracks(limit),
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
  return useInfiniteQuery({
    queryKey: queryKeys.artistRecentPlays(id ?? "", limit),
    queryFn: ({ pageParam }) => api.getArtistRecentPlays(id ?? "", typeof pageParam === "string" ? pageParam : undefined, limit),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  });
}

export function useAlbumRecentPlaysQuery(id: string | undefined, enabled: boolean, limit = 20) {
  return useInfiniteQuery({
    queryKey: queryKeys.albumRecentPlays(id ?? "", limit),
    queryFn: ({ pageParam }) => api.getAlbumRecentPlays(id ?? "", typeof pageParam === "string" ? pageParam : undefined, limit),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  });
}

export function useTrackRecentPlaysQuery(id: string | undefined, enabled: boolean, limit = 20) {
  return useInfiniteQuery({
    queryKey: queryKeys.trackRecentPlays(id ?? "", limit),
    queryFn: ({ pageParam }) => api.getTrackRecentPlays(id ?? "", typeof pageParam === "string" ? pageParam : undefined, limit),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
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
