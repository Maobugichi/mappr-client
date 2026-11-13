import type { MapprSystem } from './api';
import type { Node, Rect, Viewport } from '@xyflow/react';

export type ArchitectureCanvasMemory = { viewport?: Viewport; positions: Record<string, { x: number; y: number }> };
// Nodes have fixed dimensions. Their labels/types/descriptions are presentation
// values, so changing them does not need Dagre. Edge labels reserve route space.
export function architectureLayoutKey(architecture: MapprSystem['architecture']) {
  return JSON.stringify({ nodes: architecture.nodes.map(({ id }) => ({ id })), edges: architecture.edges });
}
export function architectureDisplayBounds(bounds: Rect, nodes: Node[], positions: ArchitectureCanvasMemory['positions']): Rect {
  let left = bounds.x, top = bounds.y, right = bounds.x + bounds.width, bottom = bounds.y + bounds.height;
  for (const node of nodes) {
    const point = positions[node.id];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    left = Math.min(left, point.x - 24); top = Math.min(top, point.y - 24);
    right = Math.max(right, point.x + Number(node.style?.width ?? 220) + 24);
    bottom = Math.max(bottom, point.y + Number(node.style?.height ?? 84) + 24);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}
