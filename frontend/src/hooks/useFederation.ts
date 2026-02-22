import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { topologyApi } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import type { WaldurInstanceCreate } from '../api/types';

export function useTopology() {
  return useQuery({
    queryKey: queryKeys.topology.data,
    queryFn: () => topologyApi.getTopology(),
  });
}

export function useTopologySummary() {
  return useQuery({
    queryKey: queryKeys.topology.summary,
    queryFn: () => topologyApi.getSummary(),
  });
}

export function useInstances() {
  return useQuery({
    queryKey: queryKeys.topology.instances.list,
    queryFn: () => topologyApi.listInstances(),
  });
}

export function useCreateInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WaldurInstanceCreate) => topologyApi.createInstance(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.topology.all });
    },
  });
}

export function useDeleteInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => topologyApi.deleteInstance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.topology.all });
    },
  });
}
