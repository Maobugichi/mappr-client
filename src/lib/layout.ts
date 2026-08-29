import dagre from '@dagrejs/dagre';
import { Position, type Node, type Edge } from '@xyflow/react';

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 60;

const defaultNodeSize = () => ({ width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT });

// Runs dagre over a set of React Flow nodes/edges and returns them with
// computed positions. Nodes/edges coming from the AI have no x/y — that's
// intentionally a rendering concern, not something the model should
// reason about. TB (top-to-bottom) by default; LR available for wider,
// shallower graphs where a horizontal layout reads better.
//
// getNodeSize lets callers with variably-sized nodes (e.g. entity nodes
// whose height depends on field count) give dagre accurate dimensions —
// without it, dagre assumes every node is the same size and taller nodes
// will visually overlap their neighbors. Architecture nodes are uniform
// size, so ArchitectureCanvas doesn't need to pass this at all.
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
  getNodeSize: (node: Node) => { width: number; height: number } = defaultNodeSize
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 40, ranksep: 80 });

  nodes.forEach((node) => {
    const { width, height } = getNodeSize(node);
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const isHorizontal = direction === 'LR';

  const layoutedNodes = nodes.map((node) => {
    const { x, y } = dagreGraph.node(node.id);
    const { width, height } = getNodeSize(node);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      // dagre positions by node CENTER, React Flow expects top-left corner
      position: {
        x: x - width / 2,
        y: y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}