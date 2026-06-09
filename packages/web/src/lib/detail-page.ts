import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DetailPageEnvelope } from './api';
import { getErrorMessage } from './errors';
import { isUnauthorizedError, queryKeys } from './queries';

type UseDetailRefreshOptions<TDetail extends DetailPageEnvelope> = {
  id: string | undefined;
  detail: TDetail | undefined;
  detailError: unknown;
  refreshError: unknown;
  isRefreshing: boolean;
  resetRefresh: () => void;
  refreshErrorMessage: string;
  refresh: (options: { onError: (error: unknown) => void }) => void;
};

export function useDetailRefresh<TDetail extends DetailPageEnvelope>({
  id,
  detail,
  detailError,
  refreshError,
  isRefreshing,
  resetRefresh,
  refreshErrorMessage,
  refresh,
}: UseDetailRefreshOptions<TDetail>) {
  const queryClient = useQueryClient();
  const attemptedRefreshKeyRef = useRef<string | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);

  useEffect(() => {
    attemptedRefreshKeyRef.current = null;
    setRefreshWarning(null);
    resetRefresh();
  }, [id, resetRefresh]);

  useEffect(() => {
    if (isUnauthorizedError(detailError) || isUnauthorizedError(refreshError)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [detailError, queryClient, refreshError]);

  useEffect(() => {
    if (!id || !detail || detail.detailStatus === 'fresh' || isRefreshing) {
      return;
    }

    const refreshKey = `${id}:${detail.detailStatus}`;

    if (attemptedRefreshKeyRef.current === refreshKey) {
      return;
    }

    attemptedRefreshKeyRef.current = refreshKey;
    setRefreshWarning(null);
    refresh({
      onError: (error) => {
        setRefreshWarning(getErrorMessage(error, refreshErrorMessage));
      },
    });
  }, [detail, id, isRefreshing, refresh, refreshErrorMessage]);

  return {
    refreshWarning,
    dismissRefreshWarning: () => setRefreshWarning(null),
  };
}
