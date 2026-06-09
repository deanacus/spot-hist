import { useQuery } from "@tanstack/react-query";

import { api } from "../api";
import { fetchBootstrap, queryKeys } from "./common";

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
