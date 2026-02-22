import { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Network, Plus, Trash2, Shield, Server } from 'lucide-react';
import {
  useTopology,
  useCreateInstance,
  useDeleteInstance,
} from '../hooks/useFederation';
import type { TopologyNode, InstanceHealth } from '../api/types';
import { TrustAnchorNode } from '../components/flow/TrustAnchorNode';
import { WaldurInstanceNode } from '../components/flow/WaldurInstanceNode';
import { TopologyDetailPanel } from '../components/flow/TopologyDetailPanel';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { HelpBanner } from '../components/HelpTip';

// ---------------------------------------------------------------------------
// Dagre layout
// ---------------------------------------------------------------------------

const NODE_WIDTH = 220;
const NODE_HEIGHT_TA = 60;
const NODE_HEIGHT_INST = 80;

function layoutTopologyGraph(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 });

  const heightMap = new Map<string, number>();
  nodes.forEach((node) => {
    const h = node.type === 'topologyTrustAnchor' ? NODE_HEIGHT_TA : NODE_HEIGHT_INST;
    heightMap.set(node.id, h);
    g.setNode(node.id, { width: NODE_WIDTH, height: h });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const h = heightMap.get(node.id) ?? 80;
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - h / 2 },
    };
  });
}

// ---------------------------------------------------------------------------
// Custom node types — wrap existing components for topology context
// ---------------------------------------------------------------------------

function TopologyTrustAnchorNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  // Create a minimal entity-like object for the TrustAnchorNode
  const fakeEntity = {
    name: data.label as string,
    organization: (data.url as string) || '',
    entity_id: (data.url as string) || '',
    id: '',
    country: null,
    entity_types: ['federation_entity'],
    metadata: {},
    jwks: { keys: [] },
    status: 'active' as const,
    authority_hints: [],
    contacts: [],
    statement_expires_seconds: null,
    created_at: '',
    updated_at: '',
  };
  return <TrustAnchorNode data={{ entity: fakeEntity, isAnchor: true, trustMarks: [] }} selected={selected} />;
}

const nodeTypes: NodeTypes = {
  topologyTrustAnchor: TopologyTrustAnchorNode,
  topologyInstance: WaldurInstanceNode,
};

// ---------------------------------------------------------------------------
// Federation Page
// ---------------------------------------------------------------------------

export default function Federation() {
  const { data: topology, isLoading } = useTopology();
  const createInstance = useCreateInstance();
  const deleteInstance = useDeleteInstance();

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerUrl, setRegisterUrl] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const instances = topology?.instances ?? [];
  const summary = topology?.summary;

  const deleteTarget = useMemo(
    () => instances.find((inst: InstanceHealth) => inst.instance_id === deleteTargetId) ?? null,
    [instances, deleteTargetId],
  );

  // Build React Flow nodes + edges from topology data
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!topology) return { flowNodes: [], flowEdges: [] };

    const rawNodes: Node[] = topology.nodes.map((n: TopologyNode) => {
      if (n.type === 'trust_anchor') {
        return {
          id: n.id,
          type: 'topologyTrustAnchor',
          position: { x: 0, y: 0 },
          data: { label: n.label, url: n.data.url },
        };
      }
      return {
        id: n.id,
        type: 'topologyInstance',
        position: { x: 0, y: 0 },
        data: {
          label: n.label,
          status: n.data.status as string,
          base_url: n.data.base_url as string,
          entity_count: (n.data.entity_count as number) || 0,
          user_count: (n.data.user_count as number) || 0,
        },
      };
    });

    const rawEdges: Edge[] = topology.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'default',
      style: { strokeDasharray: '6 3', stroke: '#6366f1' },
      animated: true,
    }));

    const laidOut = layoutTopologyGraph(rawNodes, rawEdges);
    return { flowNodes: laidOut, flowEdges: rawEdges };
  }, [topology]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !topology) return null;
    return topology.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, topology]);

  const handleNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleRegister = async () => {
    if (!registerName.trim() || !registerUrl.trim()) return;
    await createInstance.mutateAsync({ name: registerName.trim(), base_url: registerUrl.trim() });
    setRegisterName('');
    setRegisterUrl('');
    setShowRegisterModal(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    await deleteInstance.mutateAsync(deleteTargetId);
    setDeleteTargetId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const deleteDescription = deleteTarget
    ? `This will remove "${deleteTarget.name}" from the federation. ` +
      `It currently has ${deleteTarget.entity_count} entities, ${deleteTarget.user_count} users, ` +
      `and ${deleteTarget.trust_anchor_urls.length} trust anchor${deleteTarget.trust_anchor_urls.length !== 1 ? 's' : ''}.\n\n` +
      `All registered instances will be notified of the removal via a push notification. ` +
      `Instances also discover changes by polling /federation/list. Existing subordinate statements will expire naturally.`
    : '';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Federation</h1>
          <p className="text-gray-500 text-sm mt-1">
            Waldur instance connectivity and federation topology
          </p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Register Instance
        </button>
      </div>

      {/* Summary bar */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{summary.total_instances}</div>
            <div className="text-xs text-gray-500">Instances</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{summary.healthy_instances}</div>
            <div className="text-xs text-gray-500">Healthy</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">{summary.total_federations}</div>
            <div className="text-xs text-gray-500">Federations</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{summary.total_federation_entities}</div>
            <div className="text-xs text-gray-500">Fed. Entities</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{summary.total_users}</div>
            <div className="text-xs text-gray-500">Users</div>
          </div>
        </div>
      )}

      {/* OIDC Federation discovery info */}
      {instances.length > 0 && (
        <HelpBanner className="mb-6">
          <strong>Push + Pull:</strong> Lifecycle changes (entity activation, suspension, revocation
          and instance registration/removal) trigger push notifications to all registered instances.
          Instances also poll <code className="bg-blue-100 px-1 rounded">/federation/list</code> as
          the authoritative source of truth per OIDC Federation 1.0.
        </HelpBanner>
      )}

      {/* Instance health cards */}
      {instances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {instances.map((inst: InstanceHealth) => {
            const statusDot =
              inst.status === 'healthy'
                ? 'bg-green-500'
                : inst.status === 'unhealthy'
                  ? 'bg-red-500'
                  : 'bg-gray-400';

            return (
              <div key={inst.instance_id} className="bg-white rounded-lg shadow p-4 relative">
                <button
                  onClick={() => {
                    setDeleteTargetId(inst.instance_id);
                    setShowDeleteConfirm(true);
                  }}
                  disabled={deleteInstance.isPending}
                  className="absolute top-2 right-2 p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove instance"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${statusDot} flex-shrink-0`} />
                  <span className="font-semibold text-sm text-gray-900 truncate">
                    {inst.name}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate mb-3">{inst.base_url}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {inst.trust_anchor_urls.map((url: string) => (
                    <span
                      key={url}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700"
                    >
                      <Shield className="w-2.5 h-2.5" />
                      {url.replace(/^https?:\/\//, '')}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{inst.entity_count} entities</span>
                  <span>{inst.user_count} users</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Topology Graph */}
      {flowNodes.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Topology Graph</h2>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-gradient-to-br from-indigo-100 to-white border border-indigo-400" />
                Trust Anchor
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-white border-2 border-green-400" />
                Instance (healthy)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-white border-2 border-red-400" />
                Instance (unhealthy)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-8 border-t-2 border-dashed border-indigo-400" />
                Trusts
              </span>
            </div>
          </div>
          <div className="relative" style={{ height: 500 }}>
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              fitView
              minZoom={0.3}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} />
              <Controls />
            </ReactFlow>
            <TopologyDetailPanel
              node={selectedNode}
              instances={instances}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {instances.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No instances registered</h3>
          <p className="text-sm text-gray-500 mb-4">
            Register Waldur instances to see federation topology and health status.
          </p>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Register Instance
          </button>
        </div>
      )}

      {/* Register Modal */}
      <Modal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="Register Waldur Instance"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g. Waldur CSC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
            <input
              type="url"
              value={registerUrl}
              onChange={(e) => setRegisterUrl(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g. http://localhost:9501"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={() => setShowRegisterModal(false)}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleRegister}
            disabled={!registerName.trim() || !registerUrl.trim() || createInstance.isPending}
            className="btn-primary"
          >
            {createInstance.isPending ? 'Registering...' : 'Register'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteTargetId(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Remove Federation Member"
        description={deleteDescription}
        confirmText="Remove Instance"
        variant="danger"
      />
    </div>
  );
}
