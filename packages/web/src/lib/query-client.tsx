import { QueryClient, QueryClientProvider, type DefaultOptions } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { ApiError } from "./api";

const QUERY_STALE_TIME_MS = 30_000;
const QUERY_GC_TIME_MS = 5 * 60 * 1_000;
const MAX_RETRY_ATTEMPTS = 1;

function shouldRetryRequest(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }

  return failureCount < MAX_RETRY_ATTEMPTS;
}

const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
    retry: shouldRetryRequest,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  mutations: {
    retry: shouldRetryRequest,
  },
};

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions,
  });
}

const appQueryClient = createAppQueryClient();

type AppQueryProviderProps = PropsWithChildren<{
  client?: QueryClient;
}>;

export function AppQueryProvider({
  children,
  client = appQueryClient,
}: AppQueryProviderProps) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
