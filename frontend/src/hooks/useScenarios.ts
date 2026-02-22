import { useMutation, useQuery } from '@tanstack/react-query';
import { scenarioApi } from '../api/client';
import { queryKeys } from '../api/queryKeys';

export function useScenarios() {
  return useQuery({
    queryKey: queryKeys.scenarios.list,
    queryFn: () => scenarioApi.list(),
  });
}

export function useRunScenario() {
  return useMutation({
    mutationFn: (id: string) => scenarioApi.run(id),
  });
}
