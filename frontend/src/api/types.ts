// Entity types
export type EntityStatus = 'draft' | 'active' | 'suspended' | 'revoked';

export interface Entity {
  id: string;
  entity_id: string;
  name: string;
  organization: string | null;
  country: string | null;
  entity_types: string[];
  metadata: Record<string, unknown>;
  jwks: { keys: JWK[] };
  status: EntityStatus;
  authority_hints: string[];
  contacts: string[];
  statement_expires_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface EntityCreate {
  entity_id: string;
  name: string;
  organization?: string;
  country?: string;
  entity_types?: string[];
  metadata?: Record<string, unknown>;
  authority_hints?: string[];
  contacts?: string[];
  statement_expires_seconds?: number;
  jwks?: { keys: JWK[] };
}

export interface EntityUpdate {
  name?: string;
  organization?: string;
  country?: string;
  entity_types?: string[];
  metadata?: Record<string, unknown>;
  authority_hints?: string[];
  contacts?: string[];
  statement_expires_seconds?: number;
}

export interface EntityListResponse {
  entities: Entity[];
  total: number;
}

// Subordinate Statement
export interface SubordinateStatement {
  id: string;
  issuer_entity_id: string;
  subject_entity_id: string;
  metadata_override: Record<string, unknown>;
  metadata_policy: Record<string, unknown>;
  constraints: Record<string, unknown>;
  trust_marks: unknown[];
  issued_at: string;
  expires_at: string;
  jwt: string;
  is_current: boolean;
}

export interface StatementCreate {
  subject_entity_id: string;
  metadata_override?: Record<string, unknown>;
  metadata_policy?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  trust_marks?: Record<string, unknown>[];
  expires_in_seconds?: number;
}

export interface StatementListResponse {
  statements: SubordinateStatement[];
  total: number;
}

// Metadata Policy
export interface MetadataPolicy {
  id: string;
  name: string;
  description: string | null;
  entity_type: string;
  policy: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PolicyCreate {
  name: string;
  description?: string;
  entity_type: string;
  policy: Record<string, unknown>;
}

export interface PolicyUpdate {
  name?: string;
  description?: string;
  entity_type?: string;
  policy?: Record<string, unknown>;
}

export interface PolicyListResponse {
  policies: MetadataPolicy[];
  total: number;
}

export interface EntityComplianceResult {
  entity_id: string;
  entity_name: string;
  entity_url: string;
  status: 'compliant' | 'non_compliant' | 'error';
  violations: string[];
}

export interface PolicyEvaluationResponse {
  policy_id: string;
  policy_name: string;
  entity_type: string;
  total_entities: number;
  compliant: number;
  non_compliant: number;
  results: EntityComplianceResult[];
}

// Trust Mark
export type TrustMarkStatus = 'active' | 'revoked';

export interface TrustMarkDefinition {
  id: string;
  trust_mark_id: string;
  name: string;
  description: string | null;
  ref: string | null;
  logo_uri: string | null;
  allowed_issuer_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface TrustMarkDefinitionCreate {
  trust_mark_id: string;
  name: string;
  description?: string;
  ref?: string;
  logo_uri?: string;
  allowed_issuer_ids?: string[];
}

export interface TrustMark {
  id: string;
  trust_mark_id: string;
  subject_entity_id: string;
  issued_at: string;
  expires_at: string | null;
  jwt: string;
  status: TrustMarkStatus;
  revoked_at: string | null;
  revocation_reason: string | null;
}

export interface TrustMarkIssue {
  trust_mark_id: string;
  subject_entity_id: string;
  expires_in_seconds?: number;
}

export interface TrustMarkListResponse {
  trust_marks: TrustMark[];
  total: number;
}

export interface TrustMarkDefinitionListResponse {
  definitions: TrustMarkDefinition[];
  total: number;
}

// Signing Key
export interface JWK {
  kty: string;
  kid: string;
  alg?: string;
  use?: string;
  [key: string]: unknown;
}

// Federation Topology
export type WaldurInstanceStatus = 'unknown' | 'healthy' | 'unhealthy';

export interface WaldurInstance {
  id: string;
  name: string;
  base_url: string;
  status: WaldurInstanceStatus;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaldurInstanceCreate {
  name: string;
  base_url: string;
}

export interface FederationEntityInfo {
  entity_id: string;
  isd_source: string | null;
  trust_anchor_url: string | null;
  is_active: boolean;
}

export interface InstanceHealth {
  instance_id: string;
  name: string;
  base_url: string;
  status: string;
  trust_anchor_urls: string[];
  entity_count: number;
  user_count: number;
  federation_entities: FederationEntityInfo[];
}

export interface TopologyNode {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string | null;
}

export interface TopologySummary {
  total_instances: number;
  healthy_instances: number;
  total_federations: number;
  total_federation_entities: number;
  total_users: number;
}

export interface TopologyResponse {
  instances: InstanceHealth[];
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  summary: TopologySummary;
}

// Scenarios
export type ScenarioStepStatus = 'passed' | 'failed' | 'skipped';

export interface ScenarioStepResult {
  name: string;
  status: ScenarioStepStatus;
  detail: string;
  duration_ms: number;
}

export interface ScenarioMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  requires_mock_instances: boolean;
}

export interface ScenarioListResponse {
  scenarios: ScenarioMeta[];
}

export interface ScenarioRunResponse {
  scenario_id: string;
  scenario_name: string;
  status: 'passed' | 'failed' | 'partial';
  steps: ScenarioStepResult[];
  duration_ms: number;
}

// Health / Dashboard
export interface DashboardStats {
  entities: {
    total: number;
    by_status: Record<string, number>;
  };
  statements: {
    current: number;
    expiring_soon: number;
    expired: number;
  };
  keys: {
    active: number;
  };
  trust_marks: {
    active: number;
    definitions: number;
  };
}

export interface ExpiringItems {
  statements: {
    id: string;
    subject: string;
    expires_at: string;
  }[];
  trust_marks: {
    id: string;
    subject: string;
    trust_mark_id: string;
    expires_at: string | null;
  }[];
}
