import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export function TrustChainEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{ stroke: '#3b82f6', strokeWidth: 3 }}
    />
  );
}
