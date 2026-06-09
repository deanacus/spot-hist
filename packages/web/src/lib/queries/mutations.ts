import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../api";
import {
  invalidateAuthenticatedQueries,
  invalidatePlayDerivedQueries,
  queryKeys,
} from "./common";

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
