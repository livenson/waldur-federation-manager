import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trustMarkApi } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import type { TrustMarkDefinitionCreate, TrustMarkIssue } from '../api/types';

export function useTrustMarkDefinitions() {
  return useQuery({
    queryKey: queryKeys.trustMarks.definitions,
    queryFn: () => trustMarkApi.listDefinitions(),
  });
}

export function useTrustMarkDefinition(id: string) {
  return useQuery({
    queryKey: queryKeys.trustMarks.definitionDetail(id),
    queryFn: () => trustMarkApi.getDefinition(id),
    enabled: !!id,
  });
}

export function useCreateTrustMarkDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TrustMarkDefinitionCreate) => trustMarkApi.createDefinition(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trustMarks.definitions });
    },
  });
}

export function useDeleteTrustMarkDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trustMarkApi.deleteDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trustMarks.definitions });
    },
  });
}

export function useTrustMarks(params?: { subject_entity_id?: string; trust_mark_id?: string; status?: string }) {
  return useQuery({
    queryKey: queryKeys.trustMarks.list(params),
    queryFn: () => trustMarkApi.list(params),
  });
}

export function useIssueTrustMark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TrustMarkIssue) => trustMarkApi.issue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trustMarks.all });
    },
  });
}

export function useRevokeTrustMark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      trustMarkApi.revoke(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trustMarks.all });
    },
  });
}
