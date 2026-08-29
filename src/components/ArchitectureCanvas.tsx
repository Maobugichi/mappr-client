'use client';

import { useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getLayoutedElements } from '@/lib/layout';
import { ArchitectureNode } from './nodes/ArchitectureNode';
import { NodeInspector } from './NodeInspector';
import type { MapprSystem } from '@/lib/api';

const nodeTypes = { architecture: ArchitectureNode };

type ArchitectureCanvasProps = {
  architecture: MapprSystem['architecture'];
};

function ArchitectureCanvasInner({ architecture }: ArchitectureCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const rawNodes: Node[] = architecture.nodes.map((node) => ({
      id: node.id,
      type: 'architecture',
      data: { label: node.label, type: node.type },
      position: { x: 0, y: 0 }, 
    }));

    const rawEdges: Edge[] = architecture.edges.map((edge, index) => ({
      id: `${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      style: { stroke: 'var(--color-trace)' },
      labelStyle: { fill: 'var(--color-text-muted)', fontSize: 10 },
    }));

    return getLayoutedElements(rawNodes, rawEdges, 'TB');
  }, [architecture]);

  const selectedNode = useMemo(
    () => architecture.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [architecture.nodes, selectedNodeId]
  );

  const connections = useMemo(() => {
    if (!selectedNodeId) return [];
    const labelById = new Map(architecture.nodes.map((node) => [node.id, node.label]));

    return architecture.edges
      .filter((edge) => edge.from === selectedNodeId || edge.to === selectedNodeId)
      .map((edge) => {
        const isOutgoing = edge.from === selectedNodeId;
        const connectedId = isOutgoing ? edge.to : edge.from;
        return {
          direction: isOutgoing ? ('out' as const) : ('in' as const),
          label: edge.label,
          connectedLabel: labelById.get(connectedId) ?? connectedId,
        };
      });
  }, [architecture.edges, architecture.nodes, selectedNodeId]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
      >
        <Background variant={BackgroundVariant.Dots} color="var(--color-canvas-grid)" gap={24} />
        <Controls />
      </ReactFlow>

      {selectedNode && (
        <NodeInspector
          label={selectedNode.label}
          type={selectedNode.type}
          description={selectedNode.description}
          connections={connections}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </>
  );
}


export function ArchitectureCanvas(props: ArchitectureCanvasProps) {
  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-lg border border-canvas-grid bg-canvas">
      <ReactFlowProvider>
        <ArchitectureCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}