// Federation types
export interface Federation {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  public_discovery: boolean;
  require_approval: boolean;
  require_tos_acceptance: boolean;
  allow_auto_join: boolean;
  terms_of_service: string | null;
  admin_email: string;
  website_url: string | null;
  tos_url: string | null;
  tos_version: string | null;
  status: 'active' | 'suspended' | 'archived';
  created_at: string;
  instance_count: number;
  active_connections: number;
}

export interface FederationCreate {
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  public_discovery?: boolean;
  require_approval?: boolean;
  require_tos_acceptance?: boolean;
  admin_email: string;
  website_url?: string;
  tos_url?: string;
  tos_version?: string;
}

export interface FederationUpdate {
  name?: string;
  description?: string;
  logo_url?: string;
  public_discovery?: boolean;
  require_approval?: boolean;
  require_tos_acceptance?: boolean;
  allow_auto_join?: boolean;
  terms_of_service?: string;
  admin_email?: string;
  website_url?: string;
  tos_url?: string;
  tos_version?: string;
  status?: 'active' | 'suspended' | 'archived';
}

// Instance types
export type InstanceStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type ConnectionStatus = 'unknown' | 'online' | 'offline' | 'degraded' | 'maintenance';

export interface WaldurInstance {
  id: string;
  federation_id: string;
  name: string;
  api_url: string;
  homepage_url: string | null;
  uuid: string | null;
  version: string | null;
  organization_name: string;
  country: string;
  description: string | null;
  logo_url: string | null;
  admin_email: string;
  capabilities: string[];
  tags: string[];
  status: InstanceStatus;
  connection_status: ConnectionStatus;
  last_seen: string | null;
  tos_accepted: boolean;
  offering_count: number;
  customer_count: number;
  project_count: number;
  registered_at: string;
  joined_at: string | null;
}

export interface InstanceCreate {
  name: string;
  api_url: string;
  homepage_url?: string;
  organization_name: string;
  country: string;
  description?: string;
  logo_url?: string;
  admin_email: string;
  admin_name?: string;
  capabilities?: string[];
  tags?: string[];
  api_token?: string;
  tos_accepted?: boolean;
}

export interface InstanceDiscovery {
  id: string;
  name: string;
  api_url: string;
  organization_name: string;
  country: string;
  logo_url: string | null;
  capabilities: string[];
  connection_status: ConnectionStatus;
  offering_count: number;
}

// Connection types
export type ConnectionType = 'remote_customer' | 'shared_offering' | 'usage_sync';
export type ConnectionState = 'pending' | 'active' | 'paused' | 'failed' | 'terminated';

export interface FederationConnection {
  id: string;
  federation_id: string;
  source_instance_id: string;
  target_instance_id: string;
  connection_type: ConnectionType;
  state: ConnectionState;
  created_at: string;
  established_at: string | null;
  last_activity: string | null;
  error_count: number;
}

export interface ConnectionCreate {
  source_instance_id: string;
  target_instance_id: string;
  connection_type: ConnectionType;
  connection_metadata?: Record<string, unknown>;
}

// Transaction types
export type TransactionType =
  | 'customer_created'
  | 'customer_updated'
  | 'project_created'
  | 'project_updated'
  | 'resource_created'
  | 'resource_updated'
  | 'resource_terminated'
  | 'order_created'
  | 'order_approved'
  | 'order_rejected'
  | 'order_completed'
  | 'order_failed'
  | 'usage_reported'
  | 'invoice_created'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'health_check'
  | 'connection_established'
  | 'connection_lost';

export type TransactionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';

export interface FederationTransaction {
  id: string;
  federation_id: string;
  source_instance_id: string;
  target_instance_id: string | null;
  transaction_type: TransactionType;
  status: TransactionStatus;
  created_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

// Alert types
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface FederationAlert {
  id: string;
  federation_id: string;
  instance_id: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  alert_type: string;
  title: string;
  description: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

// Dashboard types
export interface DashboardStats {
  federation: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  instances: {
    total: number;
    active: number;
    online: number;
    offline: number;
    degraded: number;
  };
  connections: {
    total: number;
    active: number;
    pending: number;
    failed: number;
  };
  transactions_24h: {
    total: number;
    completed: number;
    failed: number;
    in_progress: number;
  };
  active_alerts: Record<AlertSeverity, number>;
}

export interface FederationStats {
  federation_id: string;
  federation_slug: string;
  instances: {
    total: number;
    active: number;
    online: number;
  };
  connections: {
    total: number;
    active: number;
  };
  active_alerts: number;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}
