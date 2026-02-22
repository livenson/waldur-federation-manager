import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEntities } from '../hooks/useEntities';
import { useStatements } from '../hooks/useStatements';
import { useTrustMarks, useTrustMarkDefinitions } from '../hooks/useTrustMarks';
import { useTrustChainGraph, type GraphNode, type GraphEdge } from '../hooks/useTrustChainGraph';
import { useGraphLayout } from '../components/flow/useGraphLayout';
import { TrustAnchorNode } from '../components/flow/TrustAnchorNode';
import { EntityNode } from '../components/flow/EntityNode';
import { SubordinateEdge } from '../components/flow/SubordinateEdge';
import { NodeDetailPanel } from '../components/flow/NodeDetailPanel';
import { EdgeDetailPanel } from '../components/flow/EdgeDetailPanel';
import type { Entity, EntityStatus, SubordinateStatement } from '../api/types';
import HelpTip from '../components/HelpTip';

const nodeTypes: NodeTypes = {
  trustAnchor: TrustAnchorNode,
  entity: EntityNode,
};

const edgeTypes: EdgeTypes = {
  subordinate: SubordinateEdge,
};

const ALL_STATUSES: EntityStatus[] = ['active', 'draft', 'suspended', 'revoked'];

const GROUP_COLORS = [
  { border: 'rgba(99, 102, 241, 0.25)', bg: 'rgba(99, 102, 241, 0.04)' },   // indigo
  { border: 'rgba(16, 185, 129, 0.25)', bg: 'rgba(16, 185, 129, 0.04)' },   // emerald
  { border: 'rgba(245, 158, 11, 0.25)', bg: 'rgba(245, 158, 11, 0.04)' },   // amber
  { border: 'rgba(139, 92, 246, 0.25)', bg: 'rgba(139, 92, 246, 0.04)' },   // violet
];

const GROUP_PADDING = 30;

export default function TrustChainExplorer() {
  const { data: entitiesData } = useEntities();
  const { data: statementsData } = useStatements();
  const { data: trustMarksData } = useTrustMarks();
  const { data: trustMarkDefsData } = useTrustMarkDefinitions();
  const entities = entitiesData?.entities ?? [];
  const statements = statementsData?.statements ?? [];
  const trustMarks = trustMarksData?.trust_marks ?? [];
  const trustMarkDefs = trustMarkDefsData?.definitions ?? [];
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedEntityTrustMarks, setSelectedEntityTrustMarks] = useState<GraphNode['trustMarks']>([]);
  const [selectedStatement, setSelectedStatement] = useState<SubordinateStatement | null>(null);
  const [selectedIssuerName, setSelectedIssuerName] = useState<string | undefined>();
  const [selectedSubjectName, setSelectedSubjectName] = useState<string | undefined>();

  // Filter state
  const [statusFilters, setStatusFilters] = useState<Set<EntityStatus>>(new Set(['active']));
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [typeFiltersInitialized, setTypeFiltersInitialized] = useState(false);

  // Derive unique entity types from data
  const allEntityTypes = useMemo(() => {
    const types = new Set<string>();
    entities.forEach(e => e.entity_types.forEach(t => types.add(t)));
    return Array.from(types).sort();
  }, [entities]);

  // Initialize type filters when data loads
  useEffect(() => {
    if (allEntityTypes.length > 0 && !typeFiltersInitialized) {
      setTypeFilters(new Set(allEntityTypes));
      setTypeFiltersInitialized(true);
    }
  }, [allEntityTypes, typeFiltersInitialized]);

  const anchorEntityId = useMemo(() => {
    if (!statements.length) {
      const anchor = entities.find(e =>
        e.entity_types.includes('federation_entity') &&
        e.status === 'active' &&
        e.authority_hints.length === 0
      );
      return anchor?.entity_id;
    }
    const issuers = new Set(statements.filter(s => s.is_current).map(s => s.issuer_entity_id));
    const subjects = new Set(statements.filter(s => s.is_current).map(s => s.subject_entity_id));
    for (const issuer of issuers) {
      if (!subjects.has(issuer)) return issuer;
    }
    return undefined;
  }, [entities, statements]);

  const { nodes: graphNodes, edges: graphEdges } = useTrustChainGraph(
    entities,
    statements,
    anchorEntityId,
    trustMarks,
    trustMarkDefs,
  );

  // Apply filters
  const filteredNodes = useMemo(() => {
    return graphNodes.filter(node => {
      const data = node.data as GraphNode;
      const entity = data.entity;
      // Trust anchor is always visible
      if (data.isAnchor) return true;
      // Status filter
      if (!statusFilters.has(entity.status)) return false;
      // Type filter: show if entity has at least one matching type
      if (typeFilters.size > 0 && entity.entity_types.length > 0) {
        if (!entity.entity_types.some(t => typeFilters.has(t))) return false;
      }
      return true;
    });
  }, [graphNodes, statusFilters, typeFilters]);

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return graphEdges.filter(edge =>
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [graphEdges, visibleNodeIds]);

  const { layoutGraph } = useGraphLayout();

  const layoutNodes = useMemo(() => {
    if (!filteredNodes.length) return filteredNodes;
    return layoutGraph(filteredNodes, filteredEdges);
  }, [filteredNodes, filteredEdges, layoutGraph]);

  // Compute subtree group background nodes
  const nodesWithGroups = useMemo(() => {
    if (layoutNodes.length < 3) return layoutNodes;

    // Find intermediate nodes: nodes that are both a source and a target in the edges
    const sourceIds = new Set(filteredEdges.map(e => e.source));
    const targetIds = new Set(filteredEdges.map(e => e.target));
    const intermediateIds = new Set<string>();
    for (const id of sourceIds) {
      if (targetIds.has(id)) intermediateIds.add(id);
    }

    if (intermediateIds.size === 0) return layoutNodes;

    // Build a map: intermediateId -> list of direct child node ids
    const childrenMap = new Map<string, string[]>();
    for (const edge of filteredEdges) {
      if (intermediateIds.has(edge.source)) {
        const children = childrenMap.get(edge.source) ?? [];
        // Only include leaf children (not other intermediates)
        if (!intermediateIds.has(edge.target)) {
          children.push(edge.target);
        }
        childrenMap.set(edge.source, children);
      }
    }

    const nodePositionMap = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const node of layoutNodes) {
      // Estimate rendered dimensions for bounding box
      const data = node.data as GraphNode | undefined;
      let w = 240;
      let h = 80;
      if (data?.isAnchor) {
        w = 280;
        h = 65;
      } else if (data) {
        h = 48;
        if (data.entity.organization) h += 18;
        if (data.entity.entity_types.length > 0) h += 8 + Math.ceil(data.entity.entity_types.length / 2) * 24;
        if (data.trustMarks.length > 0) h += 8 + Math.ceil(data.trustMarks.length / 2) * 24;
      }
      nodePositionMap.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        w,
        h,
      });
    }

    const groupNodes: Node[] = [];
    let colorIdx = 0;

    for (const intermediateId of intermediateIds) {
      const children = childrenMap.get(intermediateId) ?? [];
      if (children.length === 0) continue;

      // Collect all member node ids (intermediate + its children)
      const memberIds = [intermediateId, ...children];
      const positions = memberIds
        .map(id => nodePositionMap.get(id))
        .filter((p): p is { x: number; y: number; w: number; h: number } => !!p);

      if (positions.length < 2) continue;

      // Compute bounding box
      const minX = Math.min(...positions.map(p => p.x)) - GROUP_PADDING;
      const minY = Math.min(...positions.map(p => p.y)) - GROUP_PADDING;
      const maxX = Math.max(...positions.map(p => p.x + p.w)) + GROUP_PADDING;
      const maxY = Math.max(...positions.map(p => p.y + p.h)) + GROUP_PADDING;

      const color = GROUP_COLORS[colorIdx % GROUP_COLORS.length];
      colorIdx++;

      // Find the intermediate entity name for the label
      const intermediateNode = layoutNodes.find(n => n.id === intermediateId);
      const label = (intermediateNode?.data as GraphNode)?.entity.name ?? '';

      groupNodes.push({
        id: `group-${intermediateId}`,
        type: 'default',
        position: { x: minX, y: minY },
        data: { label: '' },
        style: {
          width: maxX - minX,
          height: maxY - minY,
          backgroundColor: color.bg,
          border: `1.5px dashed ${color.border}`,
          borderRadius: '12px',
          zIndex: -1,
          pointerEvents: 'none' as const,
          fontSize: '11px',
          color: color.border.replace(/[\d.]+\)$/, '0.7)'),
          padding: '6px 10px',
        },
        selectable: false,
        draggable: false,
        connectable: false,
        // Place a subtle label in the group
        className: 'font-medium',
      } as Node);

      // Add a small label node at the top-left corner of the group
      groupNodes.push({
        id: `group-label-${intermediateId}`,
        type: 'default',
        position: { x: minX + 8, y: minY + 4 },
        data: { label },
        style: {
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          fontSize: '10px',
          color: color.border.replace(/[\d.]+\)$/, '0.6)'),
          fontWeight: 600,
          pointerEvents: 'none' as const,
          width: 'auto',
          padding: 0,
          zIndex: -1,
        },
        selectable: false,
        draggable: false,
        connectable: false,
      } as Node);
    }

    // Group nodes first (lower z-index), then layout nodes on top
    return [...groupNodes, ...layoutNodes];
  }, [layoutNodes, filteredEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithGroups);
  const [edges, setEdges, onEdgesChange] = useEdgesState(filteredEdges);

  useEffect(() => {
    setNodes(nodesWithGroups);
    setEdges(filteredEdges);
  }, [nodesWithGroups, filteredEdges, setNodes, setEdges]);

  const entityMap = useMemo(() => {
    const map = new Map<string, Entity>();
    entities.forEach(e => {
      map.set(e.id, e);
      map.set(e.entity_id, e);
    });
    return map;
  }, [entities]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedStatement(null);
    const data = node.data as GraphNode | undefined;
    if (data?.entity) {
      setSelectedEntity(data.entity as Entity);
      setSelectedEntityTrustMarks(data.trustMarks ?? []);
    }
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEntity(null);
    const data = edge.data as GraphEdge | undefined;
    if (data?.statement) {
      setSelectedStatement(data.statement);
      const issuer = entityMap.get(data.statement.issuer_entity_id);
      const subject = entityMap.get(data.statement.subject_entity_id);
      setSelectedIssuerName(issuer?.name);
      setSelectedSubjectName(subject?.name);
    }
  }, [entityMap]);

  const toggleStatus = (status: EntityStatus) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const toggleType = (type: string) => {
    setTypeFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Trust Chain Explorer</h1>
        <p className="text-gray-500 text-sm mt-1">
          Interactive visualization of the federation trust hierarchy
          <HelpTip className="ml-1" text="A trust chain is the path from a Trust Anchor (root of trust) down through Intermediate Authorities to Leaf Entities. Each edge is a Subordinate Statement — a signed JWT where a superior entity vouches for a subordinate. Relying parties resolve these chains to verify that an entity is trusted. Click nodes to see entity details and trust marks; click edges to see statement details." />
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-lg shadow px-4 py-3 mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700 uppercase">Status:</span>
          {ALL_STATUSES.map(status => (
            <label key={status} className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={statusFilters.has(status)}
                onChange={() => toggleStatus(status)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="capitalize">{status}</span>
            </label>
          ))}
        </div>
        {allEntityTypes.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700 uppercase">Type:</span>
            {allEntityTypes.map(type => (
              <label key={type} className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typeFilters.has(type)}
                  onChange={() => toggleType(type)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>{type.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow relative" style={{ height: 'calc(100vh - 260px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          edgesFocusable
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'trustAnchor') return '#6366f1';
              if (n.id.startsWith('group-')) return 'transparent';
              const data = n.data as Record<string, unknown> | undefined;
              const entity = data?.entity as Entity | undefined;
              const status = entity?.status;
              if (status === 'active') return '#22c55e';
              if (status === 'suspended') return '#eab308';
              if (status === 'revoked') return '#ef4444';
              return '#9ca3af';
            }}
          />
        </ReactFlow>

        <NodeDetailPanel entity={selectedEntity} trustMarks={selectedEntityTrustMarks} onClose={() => setSelectedEntity(null)} />
        <EdgeDetailPanel
          statement={selectedStatement}
          issuerName={selectedIssuerName}
          subjectName={selectedSubjectName}
          onClose={() => setSelectedStatement(null)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
        <span className="font-medium text-gray-700">Nodes:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-500" /> Trust Anchor
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" /> Active
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-500" /> Suspended
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500" /> Revoked
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-400" /> Draft
        </div>
        <span className="font-medium text-gray-700 ml-2">Edges (statement expiry):</span>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-green-500" /> &gt;7 days
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-yellow-500" /> &lt;7 days
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-red-500" /> Expired
        </div>
        <span className="font-medium text-gray-700 ml-2">Groups:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded border border-dashed border-indigo-300 bg-indigo-50/50" /> Federation subtree
        </div>
      </div>
    </div>
  );
}
