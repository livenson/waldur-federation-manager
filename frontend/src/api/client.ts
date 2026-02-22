import axios from 'axios';
import type {
  Entity,
  EntityCreate,
  EntityUpdate,
  EntityListResponse,
  SubordinateStatement,
  StatementCreate,
  StatementListResponse,
  MetadataPolicy,
  PolicyCreate,
  PolicyUpdate,
  PolicyListResponse,
  PolicyEvaluationResponse,
  EntityComplianceResult,
  TrustMarkDefinition,
  TrustMarkDefinitionCreate,
  TrustMarkDefinitionListResponse,
  TrustMark,
  TrustMarkIssue,
  TrustMarkListResponse,
  DashboardStats,
  ExpiringItems,
  WaldurInstance,
  WaldurInstanceCreate,
  TopologyResponse,
  TopologySummary,
} from './types';
import {
  mockEntities,
  mockStatements,
  mockPolicies,
  mockTrustMarkDefinitions,
  mockTrustMarks,
  mockDashboardStats,
  mockExpiringItems,
  mockTopologyData,
  mockWaldurInstances,
  delay,
} from './mockData';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === 'true' ||
  (import.meta.env.VITE_USE_MOCK === undefined &&
    import.meta.env.MODE === 'development');

const MOCK_DELAY = 300; // ms

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Entity API
// ---------------------------------------------------------------------------

export const entityApi = {
  list: async (): Promise<EntityListResponse> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      return { entities: [...mockEntities], total: mockEntities.length };
    }
    const { data } = await api.get<EntityListResponse>('/entities');
    return data;
  },

  get: async (id: string): Promise<Entity> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const entity = mockEntities.find((e) => e.id === id);
      if (!entity) throw new Error(`Entity '${id}' not found`);
      return { ...entity };
    }
    const { data } = await api.get<Entity>(`/entities/${id}`);
    return data;
  },

  create: async (payload: EntityCreate): Promise<Entity> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const newEntity: Entity = {
        id: `ent-${Date.now()}`,
        entity_id: payload.entity_id,
        name: payload.name,
        organization: payload.organization ?? null,
        country: payload.country ?? null,
        entity_types: payload.entity_types ?? [],
        metadata: payload.metadata ?? {},
        jwks: payload.jwks ?? { keys: [] },
        status: 'draft',
        authority_hints: payload.authority_hints ?? [],
        contacts: payload.contacts ?? [],
        statement_expires_seconds: payload.statement_expires_seconds ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockEntities.push(newEntity);
      return { ...newEntity };
    }
    const { data } = await api.post<Entity>('/entities', payload);
    return data;
  },

  update: async (id: string, payload: EntityUpdate): Promise<Entity> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockEntities.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error(`Entity '${id}' not found`);
      mockEntities[idx] = {
        ...mockEntities[idx],
        ...payload,
        updated_at: new Date().toISOString(),
      };
      return { ...mockEntities[idx] };
    }
    const { data } = await api.patch<Entity>(`/entities/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockEntities.findIndex((e) => e.id === id);
      if (idx !== -1) mockEntities.splice(idx, 1);
      return;
    }
    await api.delete(`/entities/${id}`);
  },

  activate: async (id: string): Promise<Entity> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockEntities.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error(`Entity '${id}' not found`);
      mockEntities[idx].status = 'active';
      mockEntities[idx].updated_at = new Date().toISOString();
      return { ...mockEntities[idx] };
    }
    const { data } = await api.post<Entity>(`/entities/${id}/activate`);
    return data;
  },

  suspend: async (id: string): Promise<Entity> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockEntities.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error(`Entity '${id}' not found`);
      mockEntities[idx].status = 'suspended';
      mockEntities[idx].updated_at = new Date().toISOString();
      return { ...mockEntities[idx] };
    }
    const { data } = await api.post<Entity>(`/entities/${id}/suspend`);
    return data;
  },

  revoke: async (id: string): Promise<Entity> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockEntities.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error(`Entity '${id}' not found`);
      mockEntities[idx].status = 'revoked';
      mockEntities[idx].updated_at = new Date().toISOString();
      return { ...mockEntities[idx] };
    }
    const { data } = await api.post<Entity>(`/entities/${id}/revoke`);
    return data;
  },

  rotateKeys: async (id: string): Promise<Entity> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockEntities.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error(`Entity '${id}' not found`);
      // Simulate a new key being generated
      const entity = mockEntities[idx];
      const oldKey = entity.jwks.keys[0];
      const newKey = {
        ...oldKey,
        kid: `${oldKey.kid.replace(/-\d{4}$/, '')}-${new Date().getFullYear()}-rotated`,
      };
      entity.jwks = { keys: [newKey] };
      entity.updated_at = new Date().toISOString();
      return { ...entity };
    }
    const { data } = await api.post<Entity>(`/entities/${id}/rotate-keys`);
    return data;
  },
};

// ---------------------------------------------------------------------------
// Statement API
// ---------------------------------------------------------------------------

export const statementApi = {
  list: async (params?: {
    subject_entity_id?: string;
    is_current?: boolean;
  }): Promise<StatementListResponse> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      let results = [...mockStatements];
      if (params?.subject_entity_id) {
        results = results.filter(
          (s) => s.subject_entity_id === params.subject_entity_id,
        );
      }
      if (params?.is_current !== undefined) {
        results = results.filter((s) => s.is_current === params.is_current);
      }
      return { statements: results, total: results.length };
    }
    const { data } = await api.get<StatementListResponse>('/statements', {
      params,
    });
    return data;
  },

  get: async (id: string): Promise<SubordinateStatement> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const stmt = mockStatements.find((s) => s.id === id);
      if (!stmt) throw new Error(`Statement '${id}' not found`);
      return { ...stmt };
    }
    const { data } = await api.get<SubordinateStatement>(`/statements/${id}`);
    return data;
  },

  create: async (payload: StatementCreate): Promise<SubordinateStatement> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const nowMs = Date.now();
      const expiresInMs = (payload.expires_in_seconds ?? 86400) * 1000;
      const newStmt: SubordinateStatement = {
        id: `stmt-${nowMs}`,
        issuer_entity_id: 'https://federation.eudat.eu',
        subject_entity_id: payload.subject_entity_id,
        metadata_override: payload.metadata_override ?? {},
        metadata_policy: payload.metadata_policy ?? {},
        constraints: payload.constraints ?? {},
        trust_marks: payload.trust_marks ?? [],
        issued_at: new Date(nowMs).toISOString(),
        expires_at: new Date(nowMs + expiresInMs).toISOString(),
        jwt: `eyJhbGciOiJFUzI1NiJ9.${btoa(JSON.stringify({ iss: 'https://federation.eudat.eu', sub: payload.subject_entity_id }))}.mock_sig_${nowMs}`,
        is_current: true,
      };
      // Mark any existing current statement for same subject as not current
      for (const s of mockStatements) {
        if (
          s.subject_entity_id === payload.subject_entity_id &&
          s.is_current
        ) {
          s.is_current = false;
        }
      }
      mockStatements.push(newStmt);
      return { ...newStmt };
    }
    const { data } = await api.post<SubordinateStatement>(
      '/statements',
      payload,
    );
    return data;
  },

  regenerate: async (id: string): Promise<SubordinateStatement> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockStatements.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`Statement '${id}' not found`);
      const old = mockStatements[idx];
      const nowMs = Date.now();
      const expiresInMs = 86400 * 1000;
      old.is_current = false;
      const regenerated: SubordinateStatement = {
        ...old,
        id: `stmt-${nowMs}`,
        issued_at: new Date(nowMs).toISOString(),
        expires_at: new Date(nowMs + expiresInMs).toISOString(),
        jwt: `eyJhbGciOiJFUzI1NiJ9.${btoa(JSON.stringify({ iss: old.issuer_entity_id, sub: old.subject_entity_id }))}.mock_regen_${nowMs}`,
        is_current: true,
      };
      mockStatements.push(regenerated);
      return { ...regenerated };
    }
    const { data } = await api.post<SubordinateStatement>(
      `/statements/${id}/regenerate`,
    );
    return data;
  },

  bulkRegenerate: async (): Promise<{ regenerated: number }> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      let count = 0;
      const currentStatements = mockStatements.filter((s) => s.is_current);
      for (const stmt of currentStatements) {
        const nowMs = Date.now() + count; // ensure unique ids
        stmt.is_current = false;
        const regenerated: SubordinateStatement = {
          ...stmt,
          id: `stmt-${nowMs}`,
          issued_at: new Date(nowMs).toISOString(),
          expires_at: new Date(nowMs + 86400 * 1000).toISOString(),
          jwt: `eyJhbGciOiJFUzI1NiJ9.${btoa(JSON.stringify({ iss: stmt.issuer_entity_id, sub: stmt.subject_entity_id }))}.mock_bulk_${nowMs}`,
          is_current: true,
        };
        mockStatements.push(regenerated);
        count++;
      }
      return { regenerated: count };
    }
    const { data } = await api.post<{ regenerated: number }>(
      '/statements/bulk-regenerate',
    );
    return data;
  },
};

// ---------------------------------------------------------------------------
// Mock policy evaluator (ports Python apply_policy_to_value logic)
// ---------------------------------------------------------------------------

function mockEvaluatePolicy(
  policy: MetadataPolicy,
  entities: Entity[],
): PolicyEvaluationResponse {
  const matching = entities.filter((e) =>
    e.entity_types.includes(policy.entity_type),
  );

  const results: EntityComplianceResult[] = [];
  let compliantCount = 0;
  let nonCompliantCount = 0;

  for (const entity of matching) {
    const typedMetadata = (
      entity.metadata as Record<string, Record<string, unknown> | undefined>
    )[policy.entity_type];
    const violations: string[] = [];

    for (const [claim, operators] of Object.entries(policy.policy)) {
      const ops = operators as Record<string, unknown>;
      let value: unknown = typedMetadata?.[claim] ?? null;

      // value operator — replace unconditionally
      if ('value' in ops) {
        value = ops.value;
      }

      // add operator — append to list
      if ('add' in ops) {
        const addItems = Array.isArray(ops.add) ? ops.add : [ops.add];
        if (value === null || value === undefined) {
          value = addItems;
        } else if (Array.isArray(value)) {
          for (const item of addItems) {
            if (!(value as unknown[]).includes(item)) {
              (value as unknown[]).push(item);
            }
          }
        } else {
          value = [value, ...addItems];
        }
      }

      // default operator — set if missing
      if ('default' in ops) {
        if (value === null || value === undefined) {
          value = ops.default;
        }
      }

      // one_of — validate value is in allowed list
      if ('one_of' in ops && value !== null && value !== undefined) {
        const allowed = Array.isArray(ops.one_of)
          ? (ops.one_of as unknown[])
          : [ops.one_of];
        if (!allowed.includes(value)) {
          violations.push(
            `${claim}: Value ${JSON.stringify(value)} is not one of [${allowed.join(', ')}]`,
          );
        }
      }

      // subset_of — all values must be in allowed set
      if ('subset_of' in ops && value !== null && value !== undefined) {
        const allowed = new Set(
          Array.isArray(ops.subset_of) ? (ops.subset_of as string[]) : [ops.subset_of as string],
        );
        const vals = Array.isArray(value) ? (value as string[]) : [value as string];
        const extra = vals.filter((v) => !allowed.has(v));
        if (extra.length > 0) {
          violations.push(
            `${claim}: Value [${vals.join(', ')}] is not a subset of [${[...allowed].join(', ')}]`,
          );
        }
      }

      // superset_of — metadata must contain all required values
      if ('superset_of' in ops && value !== null && value !== undefined) {
        const required = Array.isArray(ops.superset_of)
          ? (ops.superset_of as string[])
          : [ops.superset_of as string];
        const vals = new Set(Array.isArray(value) ? (value as string[]) : [value as string]);
        const missing = required.filter((r) => !vals.has(r));
        if (missing.length > 0) {
          violations.push(
            `${claim}: Value is not a superset of [${required.join(', ')}]`,
          );
        }
      }

      // essential — value must be present
      if ('essential' in ops && ops.essential === true) {
        if (
          value === null ||
          value === undefined ||
          value === '' ||
          (Array.isArray(value) && value.length === 0)
        ) {
          violations.push(`${claim}: Essential value is missing or empty`);
        }
      }
    }

    if (violations.length === 0) {
      results.push({
        entity_id: entity.id,
        entity_name: entity.name,
        entity_url: entity.entity_id,
        status: 'compliant',
        violations: [],
      });
      compliantCount++;
    } else {
      results.push({
        entity_id: entity.id,
        entity_name: entity.name,
        entity_url: entity.entity_id,
        status: 'non_compliant',
        violations,
      });
      nonCompliantCount++;
    }
  }

  return {
    policy_id: policy.id,
    policy_name: policy.name,
    entity_type: policy.entity_type,
    total_entities: matching.length,
    compliant: compliantCount,
    non_compliant: nonCompliantCount,
    results,
  };
}

// ---------------------------------------------------------------------------
// Policy API
// ---------------------------------------------------------------------------

export const policyApi = {
  list: async (): Promise<PolicyListResponse> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      return { policies: [...mockPolicies], total: mockPolicies.length };
    }
    const { data } = await api.get<PolicyListResponse>('/policies');
    return data;
  },

  get: async (id: string): Promise<MetadataPolicy> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const policy = mockPolicies.find((p) => p.id === id);
      if (!policy) throw new Error(`Policy '${id}' not found`);
      return { ...policy };
    }
    const { data } = await api.get<MetadataPolicy>(`/policies/${id}`);
    return data;
  },

  create: async (payload: PolicyCreate): Promise<MetadataPolicy> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const newPolicy: MetadataPolicy = {
        id: `pol-${Date.now()}`,
        name: payload.name,
        description: payload.description ?? null,
        entity_type: payload.entity_type,
        policy: payload.policy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockPolicies.push(newPolicy);
      return { ...newPolicy };
    }
    const { data } = await api.post<MetadataPolicy>('/policies', payload);
    return data;
  },

  update: async (id: string, payload: PolicyUpdate): Promise<MetadataPolicy> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockPolicies.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error(`Policy '${id}' not found`);
      mockPolicies[idx] = {
        ...mockPolicies[idx],
        ...payload,
        updated_at: new Date().toISOString(),
      };
      return { ...mockPolicies[idx] };
    }
    const { data } = await api.patch<MetadataPolicy>(
      `/policies/${id}`,
      payload,
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockPolicies.findIndex((p) => p.id === id);
      if (idx !== -1) mockPolicies.splice(idx, 1);
      return;
    }
    await api.delete(`/policies/${id}`);
  },

  evaluate: async (id: string): Promise<PolicyEvaluationResponse> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const policy = mockPolicies.find((p) => p.id === id);
      if (!policy) throw new Error(`Policy '${id}' not found`);
      return mockEvaluatePolicy(policy, mockEntities);
    }
    const { data } = await api.post<PolicyEvaluationResponse>(
      `/policies/${id}/evaluate`,
    );
    return data;
  },
};

// ---------------------------------------------------------------------------
// Trust Mark API
// ---------------------------------------------------------------------------

export const trustMarkApi = {
  // --- Definitions ---

  listDefinitions: async (): Promise<TrustMarkDefinitionListResponse> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      return {
        definitions: [...mockTrustMarkDefinitions],
        total: mockTrustMarkDefinitions.length,
      };
    }
    const { data } = await api.get<TrustMarkDefinitionListResponse>(
      '/trust-marks/definitions',
    );
    return data;
  },

  getDefinition: async (id: string): Promise<TrustMarkDefinition> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const def = mockTrustMarkDefinitions.find((d) => d.id === id);
      if (!def) throw new Error(`Trust mark definition '${id}' not found`);
      return { ...def };
    }
    const { data } = await api.get<TrustMarkDefinition>(
      `/trust-marks/definitions/${id}`,
    );
    return data;
  },

  createDefinition: async (
    payload: TrustMarkDefinitionCreate,
  ): Promise<TrustMarkDefinition> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const newDef: TrustMarkDefinition = {
        id: `tmdef-${Date.now()}`,
        trust_mark_id: payload.trust_mark_id,
        name: payload.name,
        description: payload.description ?? null,
        ref: payload.ref ?? null,
        logo_uri: payload.logo_uri ?? null,
        allowed_issuer_ids: payload.allowed_issuer_ids ?? [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockTrustMarkDefinitions.push(newDef);
      return { ...newDef };
    }
    const { data } = await api.post<TrustMarkDefinition>(
      '/trust-marks/definitions',
      payload,
    );
    return data;
  },

  updateDefinition: async (
    id: string,
    payload: Partial<TrustMarkDefinitionCreate>,
  ): Promise<TrustMarkDefinition> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockTrustMarkDefinitions.findIndex((d) => d.id === id);
      if (idx === -1)
        throw new Error(`Trust mark definition '${id}' not found`);
      mockTrustMarkDefinitions[idx] = {
        ...mockTrustMarkDefinitions[idx],
        ...payload,
        updated_at: new Date().toISOString(),
      };
      return { ...mockTrustMarkDefinitions[idx] };
    }
    const { data } = await api.patch<TrustMarkDefinition>(
      `/trust-marks/definitions/${id}`,
      payload,
    );
    return data;
  },

  deleteDefinition: async (id: string): Promise<void> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockTrustMarkDefinitions.findIndex((d) => d.id === id);
      if (idx !== -1) mockTrustMarkDefinitions.splice(idx, 1);
      return;
    }
    await api.delete(`/trust-marks/definitions/${id}`);
  },

  // --- Trust Marks (issued) ---

  issue: async (payload: TrustMarkIssue): Promise<TrustMark> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const nowMs = Date.now();
      const expiresInMs = payload.expires_in_seconds
        ? payload.expires_in_seconds * 1000
        : null;
      const newTm: TrustMark = {
        id: `tm-${nowMs}`,
        trust_mark_id: payload.trust_mark_id,
        subject_entity_id: payload.subject_entity_id,
        issued_at: new Date(nowMs).toISOString(),
        expires_at: expiresInMs
          ? new Date(nowMs + expiresInMs).toISOString()
          : null,
        jwt: `eyJhbGciOiJFUzI1NiJ9.${btoa(JSON.stringify({ trust_mark_id: payload.trust_mark_id, sub: payload.subject_entity_id }))}.mock_tm_${nowMs}`,
        status: 'active',
        revoked_at: null,
        revocation_reason: null,
      };
      mockTrustMarks.push(newTm);
      return { ...newTm };
    }
    const { data } = await api.post<TrustMark>('/trust-marks', payload);
    return data;
  },

  list: async (params?: {
    trust_mark_id?: string;
    subject_entity_id?: string;
    status?: string;
  }): Promise<TrustMarkListResponse> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      let results = [...mockTrustMarks];
      if (params?.trust_mark_id) {
        results = results.filter(
          (tm) => tm.trust_mark_id === params.trust_mark_id,
        );
      }
      if (params?.subject_entity_id) {
        results = results.filter(
          (tm) => tm.subject_entity_id === params.subject_entity_id,
        );
      }
      if (params?.status) {
        results = results.filter((tm) => tm.status === params.status);
      }
      return { trust_marks: results, total: results.length };
    }
    const { data } = await api.get<TrustMarkListResponse>('/trust-marks', {
      params,
    });
    return data;
  },

  revoke: async (id: string, reason?: string): Promise<TrustMark> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockTrustMarks.findIndex((tm) => tm.id === id);
      if (idx === -1) throw new Error(`Trust mark '${id}' not found`);
      mockTrustMarks[idx].status = 'revoked';
      mockTrustMarks[idx].revoked_at = new Date().toISOString();
      mockTrustMarks[idx].revocation_reason = reason ?? null;
      return { ...mockTrustMarks[idx] };
    }
    const { data } = await api.post<TrustMark>(`/trust-marks/${id}/revoke`, {
      reason,
    });
    return data;
  },
};

// ---------------------------------------------------------------------------
// Health / Dashboard API
// ---------------------------------------------------------------------------

export const healthApi = {
  stats: async (): Promise<DashboardStats> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      return { ...mockDashboardStats };
    }
    const { data } = await api.get<DashboardStats>('/health/stats');
    return data;
  },

  expiring: async (days?: number): Promise<ExpiringItems> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      if (days !== undefined) {
        const cutoff = new Date(
          Date.now() + days * 86400 * 1000,
        ).toISOString();
        return {
          statements: mockExpiringItems.statements.filter(
            (s) => s.expires_at <= cutoff,
          ),
          trust_marks: mockExpiringItems.trust_marks,
        };
      }
      return { ...mockExpiringItems };
    }
    const { data } = await api.get<ExpiringItems>('/health/expiring', {
      params: days !== undefined ? { days } : undefined,
    });
    return data;
  },
};

// ---------------------------------------------------------------------------
// Topology API
// ---------------------------------------------------------------------------

export const topologyApi = {
  getTopology: async (): Promise<TopologyResponse> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      return { ...mockTopologyData };
    }
    const { data } = await api.get<TopologyResponse>('/topology');
    return data;
  },

  getSummary: async (): Promise<TopologySummary> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      return { ...mockTopologyData.summary };
    }
    const { data } = await api.get<TopologySummary>('/topology/summary');
    return data;
  },

  listInstances: async (): Promise<WaldurInstance[]> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      return [...mockWaldurInstances];
    }
    const { data } = await api.get<WaldurInstance[]>('/topology/instances');
    return data;
  },

  createInstance: async (payload: WaldurInstanceCreate): Promise<WaldurInstance> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const newInstance: WaldurInstance = {
        id: `inst-${Date.now()}`,
        name: payload.name,
        base_url: payload.base_url.replace(/\/$/, ''),
        status: 'unknown',
        last_seen_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockWaldurInstances.push(newInstance);
      return { ...newInstance };
    }
    const { data } = await api.post<WaldurInstance>('/topology/instances', payload);
    return data;
  },

  deleteInstance: async (id: string): Promise<void> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockWaldurInstances.findIndex((i) => i.id === id);
      if (idx !== -1) mockWaldurInstances.splice(idx, 1);
      return;
    }
    await api.delete(`/topology/instances/${id}`);
  },
};

export default api;
