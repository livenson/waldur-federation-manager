import { useMemo } from 'react';
import type { Node, Edge, MarkerType } from '@xyflow/react';
import type { Entity, SubordinateStatement, TrustMark, TrustMarkDefinition } from '../api/types';

export interface TrustMarkBadge {
  trust_mark_id: string;
  name: string;
  status: string;
}

export interface GraphNode extends Record<string, unknown> {
  entity: Entity;
  isAnchor: boolean;
  trustMarks: TrustMarkBadge[];
}

export interface GraphEdge extends Record<string, unknown> {
  statement: SubordinateStatement;
}

function formatExpiry(daysUntilExpiry: number): string {
  if (daysUntilExpiry <= 0) return 'expired';
  if (daysUntilExpiry < 1) return `${Math.round(daysUntilExpiry * 24)}h left`;
  return `${Math.round(daysUntilExpiry)}d left`;
}

export function useTrustChainGraph(
  entities: Entity[],
  statements: SubordinateStatement[],
  anchorEntityId?: string,
  trustMarks?: TrustMark[],
  trustMarkDefinitions?: TrustMarkDefinition[],
) {
  return useMemo(() => {
    if (!entities.length) return { nodes: [] as Node<GraphNode>[], edges: [] as Edge[] };

    // Build a lookup from trust_mark_id URL to definition name
    const defNameMap = new Map<string, string>();
    trustMarkDefinitions?.forEach(d => defNameMap.set(d.trust_mark_id, d.name));

    // Group active trust marks by subject_entity_id
    const marksByEntity = new Map<string, TrustMarkBadge[]>();
    trustMarks?.filter(m => m.status === 'active').forEach(m => {
      const badges = marksByEntity.get(m.subject_entity_id) ?? [];
      badges.push({
        trust_mark_id: m.trust_mark_id,
        name: defNameMap.get(m.trust_mark_id) ?? m.trust_mark_id.split('/').pop() ?? m.trust_mark_id,
        status: m.status,
      });
      marksByEntity.set(m.subject_entity_id, badges);
    });

    const nodes: Node<GraphNode>[] = entities.map((entity) => {
      const isAnchor = entity.entity_id === anchorEntityId;
      return {
        id: entity.id,
        type: isAnchor ? 'trustAnchor' : 'entity',
        position: { x: 0, y: 0 },
        data: { entity, isAnchor, trustMarks: marksByEntity.get(entity.entity_id) ?? [] },
      };
    });

    const entityIdToUuid = new Map(entities.map(e => [e.entity_id, e.id]));

    const edges: Edge[] = statements
      .filter(s => s.is_current)
      .reduce<Edge[]>((acc, statement) => {
        const sourceId = entityIdToUuid.get(statement.issuer_entity_id);
        const targetId = entityIdToUuid.get(statement.subject_entity_id);
        if (!sourceId || !targetId) return acc;

        const expiresAt = new Date(statement.expires_at);
        const now = new Date();
        const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        let strokeColor = '#22c55e';
        if (daysUntilExpiry <= 0) strokeColor = '#ef4444';
        else if (daysUntilExpiry <= 7) strokeColor = '#eab308';

        acc.push({
          id: `${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'subordinate',
          label: formatExpiry(daysUntilExpiry),
          style: { stroke: strokeColor, strokeWidth: 2 },
          labelStyle: { fontSize: 10, fill: strokeColor, fontWeight: 600 },
          labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
          labelBgPadding: [4, 2] as [number, number],
          markerEnd: { type: 'arrowclosed' as MarkerType, color: strokeColor, width: 16, height: 16 },
          animated: false,
          data: { statement } as GraphEdge,
        });
        return acc;
      }, []);

    return { nodes, edges };
  }, [entities, statements, anchorEntityId, trustMarks, trustMarkDefinitions]);
}
