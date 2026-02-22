import { useCallback } from 'react';
import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import type { GraphNode } from '../../hooks/useTrustChainGraph';

const NODE_WIDTH = 240;

function estimateNodeHeight(node: Node): number {
  const data = node.data as GraphNode | undefined;
  if (!data) return 80;

  // Trust Anchor: header + name + org + padding
  if (data.isAnchor) {
    let h = 50; // header + name + padding
    if (data.entity.organization) h += 18;
    return h;
  }

  // Entity node: header row + name
  let h = 48; // status row + name + vertical padding
  if (data.entity.organization) h += 18;

  // Entity type badges: ~24px per row, assume ~2 badges per row at 240px width
  if (data.entity.entity_types.length > 0) {
    const rows = Math.ceil(data.entity.entity_types.length / 2);
    h += 8 + rows * 24;
  }

  // Trust mark badges: ~24px per row, assume ~2 per row
  if (data.trustMarks.length > 0) {
    const rows = Math.ceil(data.trustMarks.length / 2);
    h += 8 + rows * 24;
  }

  return h;
}

export function useGraphLayout() {
  const layoutGraph = useCallback((nodes: Node[], edges: Edge[]): Node[] => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 });

    const heightMap = new Map<string, number>();
    nodes.forEach(node => {
      const h = estimateNodeHeight(node);
      heightMap.set(node.id, h);
      g.setNode(node.id, { width: NODE_WIDTH, height: h });
    });

    edges.forEach(edge => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    return nodes.map(node => {
      const nodeWithPosition = g.node(node.id);
      const h = heightMap.get(node.id) ?? 80;
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - NODE_WIDTH / 2,
          y: nodeWithPosition.y - h / 2,
        },
      };
    });
  }, []);

  return { layoutGraph };
}
