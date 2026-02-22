import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { policyApi } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import type { PolicyCreate, PolicyUpdate } from '../api/types';

export function usePolicies(_params?: { entity_type?: string }) {
  return useQuery({
    queryKey: queryKeys.policies.list(_params),
    queryFn: () => policyApi.list(),
  });
}

export function usePolicy(id: string) {
  return useQuery({
    queryKey: queryKeys.policies.detail(id),
    queryFn: () => policyApi.get(id),
    enabled: !!id,
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PolicyCreate) => policyApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.all });
    },
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PolicyUpdate }) =>
      policyApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.all });
    },
  });
}

export function useDeletePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => policyApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.all });
    },
  });
}

export function useEvaluatePolicy() {
  return useMutation({
    mutationFn: (id: string) => policyApi.evaluate(id),
  });
}
