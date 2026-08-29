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
import { EntityNode } from './nodes/EntityNode';
import { NodeInspector } from './NodeInspector';
import type { MapprSystem } from '@/lib/api';

const nodeTypes = { entity: EntityNode };

// Entity nodes are variably tall depending on field count — these feed
// getLayoutedElements' getNodeSize so dagre doesn't assume a fixed size
// and overlap taller entities with their neighbors.
const ENTITY_WIDTH = 240;
const ENTITY_HEADER_HEIGHT = 44;
const ENTITY_FIELD_HEIGHT = 18;
const ENTITY_PADDING = 20;

type DatabaseCanvasProps = {
  dataModel: MapprSystem['dataModel'];
};

function DatabaseCanvasInner({ dataModel }: DatabaseCanvasProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const rawNodes: Node[] = dataModel.entities.map((entity) => ({
      id: entity.id,
      type: 'entity',
      data: { name: entity.name, fields: entity.fields },
      position: { x: 0, y: 0 }, // overwritten by dagre
    }));

    const rawEdges: Edge[] = dataModel.relations.map((relation, index) => ({
      id: `${relation.from}-${relation.to}-${index}`,
      source: relation.from,
      target: relation.to,
      label: relation.label ?? relation.type,
      style: { stroke: 'var(--color-trace)' },
      labelStyle: { fill: 'var(--color-text-muted)', fontSize: 10 },
    }));

    const getNodeSize = (node: Node) => {
      const fieldCount = (node.data.fields as unknown[]).length;
      return {
        width: ENTITY_WIDTH,
        height: ENTITY_HEADER_HEIGHT + fieldCount * ENTITY_FIELD_HEIGHT + ENTITY_PADDING,
      };
    };

    return getLayoutedElements(rawNodes, rawEdges, 'TB', getNodeSize);
  }, [dataModel]);

  const selectedEntity = useMemo(
    () => dataModel.entities.find((entity) => entity.id === selectedEntityId) ?? null,
    [dataModel.entities, selectedEntityId]
  );

  const connections = useMemo(() => {
    if (!selectedEntityId) return [];
    const nameById = new Map(dataModel.entities.map((entity) => [entity.id, entity.name]));

    return dataModel.relations
      .filter(
        (relation) => relation.from === selectedEntityId || relation.to === selectedEntityId
      )
      .map((relation) => {
        const isOutgoing = relation.from === selectedEntityId;
        const connectedId = isOutgoing ? relation.to : relation.from;
        return {
          direction: isOutgoing ? ('out' as const) : ('in' as const),
          label: relation.label ? `${relation.type} — ${relation.label}` : relation.type,
          connectedLabel: nameById.get(connectedId) ?? connectedId,
        };
      });
  }, [dataModel.entities, dataModel.relations, selectedEntityId]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onNodeClick={(_, node) => setSelectedEntityId(node.id)}
        onPaneClick={() => setSelectedEntityId(null)}
      >
        <Background variant={BackgroundVariant.Dots} color="var(--color-canvas-grid)" gap={24} />
        <Controls />
      </ReactFlow>

      {selectedEntity && (
        <NodeInspector
          label={selectedEntity.name}
          type="Entity"
          connections={connections}
          onClose={() => setSelectedEntityId(null)}
        />
      )}
    </>
  );
}

export function DatabaseCanvas(props: DatabaseCanvasProps) {
  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-lg border border-canvas-grid bg-canvas">
      <ReactFlowProvider>
        <DatabaseCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}