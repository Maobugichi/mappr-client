'use client';

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { getArchitectureEdgePath, getArchitectureLabelSize, type ArchitectureRoute } from '@/lib/architecture-layout';

export function ArchitectureEdge({
  id, data, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  label, labelStyle, labelBgStyle, style, markerStart, markerEnd, interactionWidth,
}: EdgeProps) {
  const route = data?.route as ArchitectureRoute | undefined;
  const [fallbackPath, fallbackX, fallbackY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });
  const anchor = route?.label ?? { x: fallbackX, y: fallbackY };
  const labelSize = route
    ? { width: route.labelWidth, height: route.labelHeight }
    : getArchitectureLabelSize(label);
  const fullLabel = typeof label === 'string' || typeof label === 'number' ? String(label) : undefined;
  // Attach to live handles while keeping the lanes reserved during layout.
  const points = route?.points.map((point, index, all) => index === 0
    ? { x: sourceX, y: sourceY }
    : index === all.length - 1 ? { x: targetX, y: targetY } : point);
  const path = points ? getArchitectureEdgePath(points, anchor) : fallbackPath;

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerStart={markerStart}
        markerEnd={markerEnd} interactionWidth={interactionWidth} />
      {label != null && label !== '' && (
        <EdgeLabelRenderer>
          <div
            className="mappr-edge-label nodrag nopan font-body"
            role="note"
            tabIndex={0}
            title={fullLabel}
            aria-label={fullLabel}
            data-edge-id={id}
            data-anchor-x={anchor.x}
            data-anchor-y={anchor.y}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${anchor.x}px, ${anchor.y}px)`,
              boxSizing: 'border-box', width: labelSize.width, height: labelSize.height,
              padding: '6px 8px', borderRadius: 4,
              background: typeof labelBgStyle?.fill === 'string' ? labelBgStyle.fill : 'var(--color-surface-raised)',
              color: typeof labelStyle?.fill === 'string' ? labelStyle.fill : 'var(--color-text-muted)',
              fontSize: 12, lineHeight: '20px', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'all',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
