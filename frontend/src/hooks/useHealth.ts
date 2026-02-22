import { useQuery } from '@tanstack/react-query';
import { healthApi } from '../api/client';
import { queryKeys } from '../api/queryKeys';

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.health.stats,
    queryFn: () => healthApi.stats(),
  });
}

export function useExpiringItems(days?: number) {
  return useQuery({
    queryKey: queryKeys.health.expiring(days),
    queryFn: () => healthApi.expiring(days),
  });
}
