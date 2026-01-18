import axios from 'axios';
import type {
  Federation,
  FederationCreate,
  FederationUpdate,
  WaldurInstance,
  InstanceCreate,
  InstanceDiscovery,
  FederationConnection,
  ConnectionCreate,
  FederationTransaction,
  FederationAlert,
  DashboardStats,
} from './types';
import {
  mockFederations,
  mockInstances,
  mockConnections,
  mockTransactions,
  mockAlerts,
  mockDashboardStats,
  getMockInstances,
  getMockConnections,
  getMockTransactions,
  getMockAlerts,
  delay,
} from './mockData';

// Check if we should use mock data
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.MODE === 'development';
const MOCK_DELAY = 300; // Simulate network delay

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Federation API
export const federationApi = {
  list: async (): Promise<Federation[]> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      return mockFederations;
    }
    const { data } = await api.get('/federations/');
    return data;
  },

  get: async (slug: string): Promise<Federation> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const fed = mockFederations.find(f => f.slug === slug);
      if (!fed) throw new Error(`Federation '${slug}' not found`);
      return fed;
    }
    const { data } = await api.get(`/federations/${slug}`);
    return data;
  },

  create: async (federation: FederationCreate): Promise<Federation> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const newFed: Federation = {
        id: `fed-${Date.now()}`,
        ...federation,
        description: federation.description || null,
        logo_url: federation.logo_url || null,
        public_discovery: federation.public_discovery ?? true,
        require_approval: federation.require_approval ?? true,
        require_tos_acceptance: federation.require_tos_acceptance ?? true,
        allow_auto_join: false,
        terms_of_service: null,
        website_url: federation.website_url || null,
        tos_url: federation.tos_url || null,
        tos_version: federation.tos_version || null,
        status: 'active',
        created_at: new Date().toISOString(),
        instance_count: 0,
        active_connections: 0,
      };
      mockFederations.push(newFed);
      return newFed;
    }
    const { data } = await api.post('/federations/', federation);
    return data;
  },

  update: async (slug: string, updates: FederationUpdate): Promise<Federation> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockFederations.findIndex(f => f.slug === slug);
      if (idx === -1) throw new Error(`Federation '${slug}' not found`);
      mockFederations[idx] = { ...mockFederations[idx], ...updates };
      return mockFederations[idx];
    }
    const { data } = await api.patch(`/federations/${slug}`, updates);
    return data;
  },

  delete: async (slug: string): Promise<void> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockFederations.findIndex(f => f.slug === slug);
      if (idx !== -1) {
        mockFederations[idx].status = 'archived';
      }
      return;
    }
    await api.delete(`/federations/${slug}`);
  },

  getStats: async (slug: string): Promise<DashboardStats> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const fed = mockFederations.find(f => f.slug === slug);
      if (!fed) throw new Error(`Federation '${slug}' not found`);
      return mockDashboardStats[fed.id] || mockDashboardStats['fed-001'];
    }
    const { data } = await api.get(`/federations/${slug}/stats`);
    return data;
  },
};

// Instance API
export const instanceApi = {
  list: async (federationSlug: string, filters?: {
    status?: string;
    connection_status?: string;
  }): Promise<WaldurInstance[]> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const fed = mockFederations.find(f => f.slug === federationSlug);
      if (!fed) throw new Error(`Federation '${federationSlug}' not found`);
      let instances = getMockInstances(fed.id);
      if (filters?.status) {
        instances = instances.filter(i => i.status === filters.status);
      }
      if (filters?.connection_status) {
        instances = instances.filter(i => i.connection_status === filters.connection_status);
      }
      return instances;
    }
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.connection_status) params.set('connection_status', filters.connection_status);
    const { data } = await api.get(`/federations/${federationSlug}/instances?${params}`);
    return data;
  },

  discover: async (federationSlug: string, filters?: {
    capability?: string;
    country?: string;
  }): Promise<InstanceDiscovery[]> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const fed = mockFederations.find(f => f.slug === federationSlug);
      if (!fed) throw new Error(`Federation '${federationSlug}' not found`);
      let instances = getMockInstances(fed.id).filter(i => i.status === 'active');
      if (filters?.capability) {
        instances = instances.filter(i => i.capabilities.includes(filters.capability!));
      }
      if (filters?.country) {
        instances = instances.filter(i => i.country === filters.country);
      }
      return instances.map(i => ({
        id: i.id,
        name: i.name,
        api_url: i.api_url,
        organization_name: i.organization_name,
        country: i.country,
        logo_url: i.logo_url,
        capabilities: i.capabilities,
        connection_status: i.connection_status,
        offering_count: i.offering_count,
      }));
    }
    const params = new URLSearchParams();
    if (filters?.capability) params.set('capability', filters.capability);
    if (filters?.country) params.set('country', filters.country);
    const { data } = await api.get(`/federations/${federationSlug}/instances/discover?${params}`);
    return data;
  },

  get: async (federationSlug: string, instanceId: string): Promise<WaldurInstance> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const instance = mockInstances.find(i => i.id === instanceId);
      if (!instance) throw new Error(`Instance '${instanceId}' not found`);
      return instance;
    }
    const { data } = await api.get(`/federations/${federationSlug}/instances/${instanceId}`);
    return data;
  },

  register: async (federationSlug: string, instance: InstanceCreate): Promise<WaldurInstance> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const fed = mockFederations.find(f => f.slug === federationSlug);
      if (!fed) throw new Error(`Federation '${federationSlug}' not found`);
      const newInstance: WaldurInstance = {
        id: `inst-${Date.now()}`,
        federation_id: fed.id,
        name: instance.name,
        api_url: instance.api_url,
        homepage_url: instance.homepage_url || null,
        uuid: null,
        version: null,
        organization_name: instance.organization_name,
        country: instance.country,
        description: instance.description || null,
        logo_url: instance.logo_url || null,
        admin_email: instance.admin_email,
        capabilities: instance.capabilities || [],
        tags: instance.tags || [],
        status: fed.require_approval ? 'pending' : 'active',
        connection_status: 'unknown',
        last_seen: null,
        tos_accepted: instance.tos_accepted || false,
        offering_count: 0,
        customer_count: 0,
        project_count: 0,
        registered_at: new Date().toISOString(),
        joined_at: null,
      };
      mockInstances.push(newInstance);
      return newInstance;
    }
    const { data } = await api.post(`/federations/${federationSlug}/instances`, instance);
    return data;
  },

  update: async (
    federationSlug: string,
    instanceId: string,
    updates: Partial<WaldurInstance>
  ): Promise<WaldurInstance> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockInstances.findIndex(i => i.id === instanceId);
      if (idx === -1) throw new Error(`Instance '${instanceId}' not found`);
      mockInstances[idx] = { ...mockInstances[idx], ...updates };
      return mockInstances[idx];
    }
    const { data } = await api.patch(`/federations/${federationSlug}/instances/${instanceId}`, updates);
    return data;
  },

  approve: async (federationSlug: string, instanceId: string): Promise<WaldurInstance> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockInstances.findIndex(i => i.id === instanceId);
      if (idx === -1) throw new Error(`Instance '${instanceId}' not found`);
      mockInstances[idx].status = 'active';
      return mockInstances[idx];
    }
    const { data } = await api.post(`/federations/${federationSlug}/instances/${instanceId}/approve`);
    return data;
  },

  reject: async (federationSlug: string, instanceId: string): Promise<WaldurInstance> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockInstances.findIndex(i => i.id === instanceId);
      if (idx === -1) throw new Error(`Instance '${instanceId}' not found`);
      mockInstances[idx].status = 'rejected';
      return mockInstances[idx];
    }
    const { data } = await api.post(`/federations/${federationSlug}/instances/${instanceId}/reject`);
    return data;
  },

  suspend: async (federationSlug: string, instanceId: string): Promise<WaldurInstance> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockInstances.findIndex(i => i.id === instanceId);
      if (idx === -1) throw new Error(`Instance '${instanceId}' not found`);
      mockInstances[idx].status = 'suspended';
      return mockInstances[idx];
    }
    const { data } = await api.post(`/federations/${federationSlug}/instances/${instanceId}/suspend`);
    return data;
  },

  acceptTos: async (federationSlug: string, instanceId: string): Promise<WaldurInstance> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockInstances.findIndex(i => i.id === instanceId);
      if (idx === -1) throw new Error(`Instance '${instanceId}' not found`);
      mockInstances[idx].tos_accepted = true;
      return mockInstances[idx];
    }
    const { data } = await api.post(`/federations/${federationSlug}/instances/${instanceId}/accept-tos`);
    return data;
  },

  delete: async (federationSlug: string, instanceId: string): Promise<void> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockInstances.findIndex(i => i.id === instanceId);
      if (idx !== -1) mockInstances.splice(idx, 1);
      return;
    }
    await api.delete(`/federations/${federationSlug}/instances/${instanceId}`);
  },
};

// Connection API
export const connectionApi = {
  list: async (federationSlug: string, filters?: {
    state?: string;
    connection_type?: string;
    instance_id?: string;
  }): Promise<FederationConnection[]> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const fed = mockFederations.find(f => f.slug === federationSlug);
      if (!fed) throw new Error(`Federation '${federationSlug}' not found`);
      let connections = getMockConnections(fed.id);
      if (filters?.state) {
        connections = connections.filter(c => c.state === filters.state);
      }
      if (filters?.connection_type) {
        connections = connections.filter(c => c.connection_type === filters.connection_type);
      }
      if (filters?.instance_id) {
        connections = connections.filter(
          c => c.source_instance_id === filters.instance_id || c.target_instance_id === filters.instance_id
        );
      }
      return connections;
    }
    const params = new URLSearchParams();
    if (filters?.state) params.set('state', filters.state);
    if (filters?.connection_type) params.set('connection_type', filters.connection_type);
    if (filters?.instance_id) params.set('instance_id', filters.instance_id);
    const { data } = await api.get(`/federations/${federationSlug}/connections?${params}`);
    return data;
  },

  get: async (federationSlug: string, connectionId: string): Promise<FederationConnection> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const conn = mockConnections.find(c => c.id === connectionId);
      if (!conn) throw new Error(`Connection '${connectionId}' not found`);
      return conn;
    }
    const { data } = await api.get(`/federations/${federationSlug}/connections/${connectionId}`);
    return data;
  },

  create: async (federationSlug: string, connection: ConnectionCreate): Promise<FederationConnection> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const fed = mockFederations.find(f => f.slug === federationSlug);
      if (!fed) throw new Error(`Federation '${federationSlug}' not found`);
      const newConn: FederationConnection = {
        id: `conn-${Date.now()}`,
        federation_id: fed.id,
        source_instance_id: connection.source_instance_id,
        target_instance_id: connection.target_instance_id,
        connection_type: connection.connection_type,
        state: 'pending',
        created_at: new Date().toISOString(),
        established_at: null,
        last_activity: null,
        error_count: 0,
      };
      mockConnections.push(newConn);
      return newConn;
    }
    const { data } = await api.post(`/federations/${federationSlug}/connections`, connection);
    return data;
  },

  activate: async (federationSlug: string, connectionId: string): Promise<FederationConnection> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockConnections.findIndex(c => c.id === connectionId);
      if (idx === -1) throw new Error(`Connection '${connectionId}' not found`);
      mockConnections[idx].state = 'active';
      mockConnections[idx].established_at = new Date().toISOString();
      return mockConnections[idx];
    }
    const { data } = await api.post(`/federations/${federationSlug}/connections/${connectionId}/activate`);
    return data;
  },

  pause: async (federationSlug: string, connectionId: string): Promise<FederationConnection> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockConnections.findIndex(c => c.id === connectionId);
      if (idx === -1) throw new Error(`Connection '${connectionId}' not found`);
      mockConnections[idx].state = 'paused';
      return mockConnections[idx];
    }
    const { data } = await api.post(`/federations/${federationSlug}/connections/${connectionId}/pause`);
    return data;
  },

  terminate: async (federationSlug: string, connectionId: string): Promise<FederationConnection> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockConnections.findIndex(c => c.id === connectionId);
      if (idx === -1) throw new Error(`Connection '${connectionId}' not found`);
      mockConnections[idx].state = 'terminated';
      return mockConnections[idx];
    }
    const { data } = await api.post(`/federations/${federationSlug}/connections/${connectionId}/terminate`);
    return data;
  },

  delete: async (federationSlug: string, connectionId: string): Promise<void> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockConnections.findIndex(c => c.id === connectionId);
      if (idx !== -1) mockConnections.splice(idx, 1);
      return;
    }
    await api.delete(`/federations/${federationSlug}/connections/${connectionId}`);
  },
};

// Monitoring API
export const monitoringApi = {
  getDashboard: async (federationSlug: string): Promise<DashboardStats> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const fed = mockFederations.find(f => f.slug === federationSlug);
      if (!fed) throw new Error(`Federation '${federationSlug}' not found`);
      return mockDashboardStats[fed.id] || mockDashboardStats['fed-001'];
    }
    const { data } = await api.get(`/federations/${federationSlug}/dashboard`);
    return data;
  },

  listTransactions: async (federationSlug: string, filters?: {
    transaction_type?: string;
    status?: string;
    source_instance_id?: string;
    target_instance_id?: string;
  }): Promise<FederationTransaction[]> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const fed = mockFederations.find(f => f.slug === federationSlug);
      if (!fed) throw new Error(`Federation '${federationSlug}' not found`);
      let txs = getMockTransactions(fed.id);
      if (filters?.transaction_type) {
        txs = txs.filter(t => t.transaction_type === filters.transaction_type);
      }
      if (filters?.status) {
        txs = txs.filter(t => t.status === filters.status);
      }
      if (filters?.source_instance_id) {
        txs = txs.filter(t => t.source_instance_id === filters.source_instance_id);
      }
      return txs;
    }
    const params = new URLSearchParams();
    if (filters?.transaction_type) params.set('transaction_type', filters.transaction_type);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.source_instance_id) params.set('source_instance_id', filters.source_instance_id);
    if (filters?.target_instance_id) params.set('target_instance_id', filters.target_instance_id);
    const { data } = await api.get(`/federations/${federationSlug}/transactions?${params}`);
    return data;
  },

  getTransaction: async (federationSlug: string, transactionId: string): Promise<FederationTransaction> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const tx = mockTransactions.find(t => t.id === transactionId);
      if (!tx) throw new Error(`Transaction '${transactionId}' not found`);
      return tx;
    }
    const { data } = await api.get(`/federations/${federationSlug}/transactions/${transactionId}`);
    return data;
  },

  listAlerts: async (federationSlug: string, filters?: {
    severity?: string;
    status?: string;
    instance_id?: string;
  }): Promise<FederationAlert[]> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const fed = mockFederations.find(f => f.slug === federationSlug);
      if (!fed) throw new Error(`Federation '${federationSlug}' not found`);
      let alerts = getMockAlerts(fed.id);
      if (filters?.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters?.status) {
        alerts = alerts.filter(a => a.status === filters.status);
      }
      if (filters?.instance_id) {
        alerts = alerts.filter(a => a.instance_id === filters.instance_id);
      }
      return alerts;
    }
    const params = new URLSearchParams();
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.instance_id) params.set('instance_id', filters.instance_id);
    const { data } = await api.get(`/federations/${federationSlug}/alerts?${params}`);
    return data;
  },

  getActiveAlerts: async (federationSlug: string): Promise<FederationAlert[]> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const fed = mockFederations.find(f => f.slug === federationSlug);
      if (!fed) throw new Error(`Federation '${federationSlug}' not found`);
      return getMockAlerts(fed.id).filter(a => a.status === 'active');
    }
    const { data } = await api.get(`/federations/${federationSlug}/alerts/active`);
    return data;
  },

  acknowledgeAlert: async (federationSlug: string, alertId: string): Promise<FederationAlert> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockAlerts.findIndex(a => a.id === alertId);
      if (idx === -1) throw new Error(`Alert '${alertId}' not found`);
      mockAlerts[idx].status = 'acknowledged';
      mockAlerts[idx].acknowledged_at = new Date().toISOString();
      return mockAlerts[idx];
    }
    const { data } = await api.post(`/federations/${federationSlug}/alerts/${alertId}/acknowledge`);
    return data;
  },

  resolveAlert: async (federationSlug: string, alertId: string): Promise<FederationAlert> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY);
      const idx = mockAlerts.findIndex(a => a.id === alertId);
      if (idx === -1) throw new Error(`Alert '${alertId}' not found`);
      mockAlerts[idx].status = 'resolved';
      mockAlerts[idx].resolved_at = new Date().toISOString();
      return mockAlerts[idx];
    }
    const { data } = await api.post(`/federations/${federationSlug}/alerts/${alertId}/resolve`);
    return data;
  },
};

export default api;
