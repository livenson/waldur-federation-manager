export const queryKeys = {
  entities: {
    all: ['entities'] as const,
    list: (params?: Record<string, unknown>) => ['entities', 'list', params] as const,
    detail: (id: string) => ['entities', 'detail', id] as const,
  },
  statements: {
    all: ['statements'] as const,
    list: (params?: Record<string, unknown>) => ['statements', 'list', params] as const,
    detail: (id: string) => ['statements', 'detail', id] as const,
  },
  policies: {
    all: ['policies'] as const,
    list: (params?: Record<string, unknown>) => ['policies', 'list', params] as const,
    detail: (id: string) => ['policies', 'detail', id] as const,
    evaluate: (id: string) => ['policies', 'evaluate', id] as const,
  },
  trustMarks: {
    all: ['trustMarks'] as const,
    list: (params?: Record<string, unknown>) => ['trustMarks', 'list', params] as const,
    definitions: ['trustMarks', 'definitions'] as const,
    definitionDetail: (id: string) => ['trustMarks', 'definitions', id] as const,
  },
  health: {
    stats: ['health', 'stats'] as const,
    expiring: (days?: number) => ['health', 'expiring', days] as const,
  },
  scenarios: {
    all: ['scenarios'] as const,
    list: ['scenarios', 'list'] as const,
  },
  topology: {
    all: ['topology'] as const,
    data: ['topology', 'data'] as const,
    summary: ['topology', 'summary'] as const,
    instances: {
      all: ['topology', 'instances'] as const,
      list: ['topology', 'instances', 'list'] as const,
    },
  },
};
