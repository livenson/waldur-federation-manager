import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { entityApi } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import type { EntityCreate, EntityUpdate } from '../api/types';

export function useEntities(_params?: { status?: string; entity_type?: string }) {
  return useQuery({
    queryKey: queryKeys.entities.list(_params),
    queryFn: () => entityApi.list(),
  });
}

export function useEntity(id: string) {
  return useQuery({
    queryKey: queryKeys.entities.detail(id),
    queryFn: () => entityApi.get(id),
    enabled: !!id,
  });
}

export function useCreateEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: EntityCreate) => entityApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all });
    },
  });
}

export function useUpdateEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EntityUpdate }) =>
      entityApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all });
    },
  });
}

export function useActivateEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => entityApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all });
    },
  });
}

export function useSuspendEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => entityApi.suspend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all });
    },
  });
}

export function useRevokeEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => entityApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all });
    },
  });
}

export function useRotateEntityKeys() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => entityApi.rotateKeys(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all });
    },
  });
}

export function useDeleteEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => entityApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all });
    },
  });
}
