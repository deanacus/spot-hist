import type { QueryClient } from "@tanstack/react-query";

import {
  api,
  ApiError,
  type AppStatus,
  type ReportTimeframe,
  type SetupStatus,
  type SpotifyHistoryImportJob,
  type SpotifyHistoryImportJobStatus,
} from "../api";
import { getUserTimeZone } from "../datetime";
import { routes } from "../routes";

export type BootstrapData = {
  setupStatus: SetupStatus;
  appStatus: AppStatus | null;
};

export const queryKeys = {
  bootstrap: ["bootstrap"] as const,
  stats: ["stats"] as const,
  reports: ["reports"] as const,
  history: ["history"] as const,
  spotifyHistoryImportLatest: ["spotify-history-import", "latest"] as const,
  spotifyHistoryImportJob: (id: string) => ["spotify-history-import", id] as const,
  report: (timeframe: ReportTimeframe, offset: number, timeZone = getUserTimeZone()) =>
    ["reports", timeframe, offset, timeZone] as const,
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

export const SPOTIFY_HISTORY_IMPORT_POLL_INTERVAL_MS = 2_000;

export type ScrobbleScope =
  | { kind: "all" }
  | { kind: "artist"; id: string }
  | { kind: "album"; id: string }
  | { kind: "track"; id: string };

export function isActiveSpotifyHistoryImportJobStatus(
  status: SpotifyHistoryImportJobStatus | null | undefined,
) {
  return status === "queued" || status === "running";
}

export function isActiveSpotifyHistoryImportJob(job: SpotifyHistoryImportJob | null | undefined) {
  return isActiveSpotifyHistoryImportJobStatus(job?.status);
}

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

export async function invalidateAuthenticatedQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap }),
    invalidatePlayDerivedQueries(queryClient),
    queryClient.invalidateQueries({ queryKey: queryKeys.spotifyHistoryImportLatest }),
  ]);
}

export async function invalidatePlayDerivedQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.stats }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports }),
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
