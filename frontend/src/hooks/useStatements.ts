import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { statementApi } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import type { StatementCreate } from '../api/types';

export function useStatements(params?: { subject_entity_id?: string; current_only?: boolean }) {
  return useQuery({
    queryKey: queryKeys.statements.list(params),
    queryFn: () => statementApi.list(params),
  });
}

export function useStatement(id: string) {
  return useQuery({
    queryKey: queryKeys.statements.detail(id),
    queryFn: () => statementApi.get(id),
    enabled: !!id,
  });
}

export function useCreateStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StatementCreate) => statementApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.statements.all });
    },
  });
}

export function useRegenerateStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => statementApi.regenerate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.statements.all });
    },
  });
}

export function useBulkRegenerateStatements() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => statementApi.bulkRegenerate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.statements.all });
    },
  });
}
