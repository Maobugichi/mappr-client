import dagre from '@dagrejs/dagre';
import { getViewportForBounds, Position, type Edge, type Node, type Rect, type Viewport } from '@xyflow/react';

export const ARCHITECTURE_MIN_ZOOM = 0.05;
export const ARCHITECTURE_INITIAL_MAX_ZOOM = 0.65;
export const ARCHITECTURE_LABEL_MAX_WIDTH = 176;
export const ARCHITECTURE_LABEL_HEIGHT = 32;

export function getArchitectureLabelSize(label: unknown): { width: number; height: number } {
  if (label == null || label === '') return { width: 0, height: 0 };
  return {
    width: Math.min(ARCHITECTURE_LABEL_MAX_WIDTH, Math.max(48, String(label).length * 7 + 16)),
    height: ARCHITECTURE_LABEL_HEIGHT,
  };
}

export type RoutePoint = { x: number; y: number };
export type ArchitecturePort = {
  id: string;
  type: 'source' | 'target';
  position: Position;
  offset: number;
};
export type ArchitectureRoute = {
  points: RoutePoint[];
  label: RoutePoint;
  labelWidth: number;
  labelHeight: number;
};

// Reserve the entire tag box. Long connections get separate lanes around
// intermediate nodes, instead of direct curves through the rest of the graph.
export function getArchitectureLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[]; bounds: Rect } {
  if (nodes.length === 0) return { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 } };
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({
    rankdir: 'TB', nodesep: 28, ranksep: 64, edgesep: 16,
    marginx: 24, marginy: 24,
  });
  for (const node of nodes) {
    graph.setNode(node.id, { width: 220, height: 84 });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target, {
      ...getArchitectureLabelSize(edge.label), labelpos: 'c',
    }, edge.id);
  }
  dagre.layout(graph);

  const ports = new Map(nodes.map((node) => [node.id, [] as ArchitecturePort[]]));
  function port(nodeId: string, point: RoutePoint, id: string, type: ArchitecturePort['type']) {
    const node = graph.node(nodeId);
    const horizontal = Math.abs(Math.abs(point.x - node.x) - node.width / 2) < 0.01;
    const position = horizontal
      ? (point.x < node.x ? Position.Left : Position.Right)
      : (point.y < node.y ? Position.Top : Position.Bottom);
    const offset = horizontal
      ? (point.y - node.y + node.height / 2) / node.height * 100
      : (point.x - node.x + node.width / 2) / node.width * 100;
    ports.get(nodeId)!.push({ id, type, position, offset });
    return id;
  }

  const routedEdges = edges.map((edge) => {
    const route = graph.edge({ v: edge.source, w: edge.target, name: edge.id });
    const points: RoutePoint[] = route.points;
    const label = Number.isFinite(route.x) && Number.isFinite(route.y)
      ? { x: route.x, y: route.y } : points[Math.floor(points.length / 2)];
    return {
      ...edge,
      sourceHandle: port(edge.source, points[0], `${edge.id}-out`, 'source'),
      targetHandle: port(edge.target, points[points.length - 1], `${edge.id}-in`, 'target'),
      data: {
        ...edge.data,
        route: { points, label, labelWidth: route.width, labelHeight: route.height } satisfies ArchitectureRoute,
      },
    };
  });
  return {
    nodes: nodes.map((node) => {
      const { x, y, width, height } = graph.node(node.id);
      return {
        ...node,
        position: { x: x - width / 2, y: y - height / 2 },
        style: { ...node.style, width, height },
        data: { ...node.data, ports: ports.get(node.id) },
      };
    }),
    edges: routedEdges,
    bounds: { x: 0, y: 0, width: graph.graph().width ?? 0, height: graph.graph().height ?? 0 },
  };
}

// Leave screen space for the review button and iteration bar. Dagre's full
// bounds include outside connection lanes and tags as well as the nodes.
export function getArchitectureViewport(bounds: Rect, width: number, height: number, maxZoom = 1): Viewport {
  const viewport = getViewportForBounds(
    bounds, Math.max(1, width - 48), Math.max(1, height - 136),
    ARCHITECTURE_MIN_ZOOM, maxZoom, 0.04,
  );
  return { ...viewport, x: viewport.x + 24, y: viewport.y + 48 };
}

// Initial fitting includes every node, routed lane and label, capped at 0.65.
// The explicit Fit control retains its existing maximum zoom of 1.
export function getArchitectureInitialViewport(bounds: Rect, width: number, height: number): Viewport {
  return getArchitectureViewport(bounds, width, height, ARCHITECTURE_INITIAL_MAX_ZOOM);
}

// Round small corners only. Broad Beziers cut through the clearances reserved
// by layout. Keep the tag's anchor exact beneath its opaque background.
export function getArchitectureEdgePath(points: RoutePoint[], label: RoutePoint): string {
  if (points.length === 0) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1], point = points[i], next = points[i + 1];
    const incoming = Math.hypot(point.x - previous.x, point.y - previous.y);
    const outgoing = Math.hypot(next.x - point.x, next.y - point.y);
    if (!incoming || !outgoing || (point.x === label.x && point.y === label.y)) {
      path += ` L ${point.x} ${point.y}`;
      continue;
    }
    const radius = Math.min(16, incoming / 4, outgoing / 4);
    const before = { x: point.x + (previous.x - point.x) * radius / incoming,
      y: point.y + (previous.y - point.y) * radius / incoming };
    const after = { x: point.x + (next.x - point.x) * radius / outgoing,
      y: point.y + (next.y - point.y) * radius / outgoing };
    path += ` L ${before.x} ${before.y} Q ${point.x} ${point.y} ${after.x} ${after.y}`;
  }
  if (points.length > 1) {
    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y}`;
  }
  return path;
}
