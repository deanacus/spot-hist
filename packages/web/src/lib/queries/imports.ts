import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type SpotifyHistoryImportJob, type SpotifyHistoryImportJobStatus } from "../api";
import {
  invalidateAuthenticatedQueries,
  isActiveSpotifyHistoryImportJob,
  isActiveSpotifyHistoryImportJobStatus,
  queryKeys,
  SPOTIFY_HISTORY_IMPORT_POLL_INTERVAL_MS,
} from "./common";

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
