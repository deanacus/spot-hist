import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useBootstrapQuery, useStatsQuery, isUnauthorizedError, queryKeys, getPageOffset } from "./queries";
import { parsePageParam } from "./routes";

type PaginatedRouteStateOptions = {
  pageParam: string | undefined;
  pageSize: number;
  baseRoute: string;
  pageRoute: (page: number) => string;
  total?: number;
};

export function usePageStatus() {
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const statsQuery = useStatsQuery(Boolean(status));

  return {
    bootstrapQuery,
    status,
    account,
    statsQuery,
  };
}

export function useInvalidateBootstrapOnUnauthorized(queryError: unknown) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isUnauthorizedError(queryError)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [queryClient, queryError]);
}

export function usePaginatedRouteState({
  pageParam,
  pageSize,
  baseRoute,
  pageRoute,
  total,
}: PaginatedRouteStateOptions) {
  const page = parsePageParam(pageParam);
  const currentPage = page ?? 1;
  const offset = getPageOffset(currentPage, pageSize);

  let redirectTo: string | null = null;

  if (page === null) {
    redirectTo = baseRoute;
  } else if (pageParam !== undefined && currentPage === 1) {
    redirectTo = baseRoute;
  } else if (total !== undefined) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > totalPages) {
      redirectTo = pageRoute(totalPages);
    }
  }

  return {
    page,
    currentPage,
    offset,
    redirectTo,
  };
}
