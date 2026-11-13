'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  ControlButton,
  useReactFlow,
  useStore,
  useStoreApi,
  type Node,
  type Edge,
  type FitViewOptions,
  type Viewport,
} from '@xyflow/react';
import { CornersOutIcon, LockIcon, LockOpenIcon, MinusIcon, PlusIcon } from '@phosphor-icons/react';
import '@xyflow/react/dist/style.css';
import controlStyles from './CanvasControls.module.css';
import styles from './DatabaseCanvas.module.css';
import { getLayoutedElements } from '@/lib/layout';
import { usePreservedViewState } from '@/lib/artifact-workspace';
import { EntityNode, type EntityNodeData } from './nodes/EntityNode';
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

// Native fitView waits for measured nodes. A zero lower bound lets it choose
// the positive scale required by the entire graph, instead of clipping at 0.5.
const FIT_OPTIONS: FitViewOptions = {
  minZoom: 0, maxZoom: 2, duration: 0,
  padding: { top: '24px', left: '24px', right: '64px', bottom: '24px' },
};
type SavedViewport = { graph: string; viewport: Viewport };

type DatabaseCanvasProps = {
  dataModel: MapprSystem['dataModel'];
};

function DatabaseCanvasInner({ dataModel }: DatabaseCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const store = useStoreApi();
  const minZoomReached = useStore((state) => state.transform[2] <= state.minZoom);
  const maxZoomReached = useStore((state) => state.transform[2] >= state.maxZoom);
  const interactive = useStore((state) => state.nodesDraggable || state.nodesConnectable || state.elementsSelectable);
  // Array identities, selection and viewport movement are not layout inputs.
  const layoutInput = JSON.stringify({ entities: dataModel.entities, relations: dataModel.relations });
  const [savedViewport, setSavedViewport] = usePreservedViewState<SavedViewport | null>('database:viewport', null);
  const initialViewport = savedViewport?.graph === layoutInput ? savedViewport.viewport : undefined;
  const rememberViewport = useCallback((viewport: Viewport) => {
    setSavedViewport({ graph: layoutInput, viewport });
  }, [layoutInput, setSavedViewport]);
  const controlDuration = () => {
    if (!canvasRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return parseFloat(getComputedStyle(canvasRef.current).getPropertyValue('--motion-fast')) || 0;
  };
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  // Keep the last entity's contents through the exit transition. Selection
  // alone controls graph focus and whether the inspector is interactive.
  const [inspectorEntityId, setInspectorEntityId] = useState<string | null>(null);
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);

  const handleSelectEntity = useCallback((id: string, trigger: HTMLElement) => {
    inspectorTriggerRef.current = trigger;
    setSelectedEntityId(id);
    setInspectorEntityId(id);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedEntityId(null);
    if (inspectorTriggerRef.current?.isConnected) {
      inspectorTriggerRef.current.focus({ preventScroll: true });
    }
  }, []);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const model = JSON.parse(layoutInput) as MapprSystem['dataModel'];
    const rawNodes: Node[] = model.entities.map((entity) => ({
      id: entity.id,
      type: 'entity',
      draggable: false,
      ariaLabel: `Entity ${entity.name}`,
      data: { name: entity.name, fields: entity.fields },
      position: { x: 0, y: 0 }, // overwritten by dagre
    }));

    const rawEdges: Edge[] = model.relations.map((relation, index) => ({
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
  }, [layoutInput]);

  const selectedEntity = useMemo(
    () => dataModel.entities.find((entity) => entity.id === selectedEntityId) ?? null,
    [dataModel.entities, selectedEntityId]
  );

  const inspectorEntity = useMemo(
    () => dataModel.entities.find((entity) => entity.id === inspectorEntityId) ?? null,
    [dataModel.entities, inspectorEntityId]
  );

  const connectedEntityIds = useMemo(() => {
    const connected = new Set<string>();
    if (!selectedEntity) return connected;
    for (const relation of dataModel.relations) {
      if (relation.from === selectedEntity.id) connected.add(relation.to);
      if (relation.to === selectedEntity.id) connected.add(relation.from);
    }
    return connected;
  }, [dataModel.relations, selectedEntity]);

  // Focus is a visual pass over the saved layout. Neither selection nor
  // inspector visibility runs Dagre or changes node dimensions.
  const nodes = useMemo(
    () => layoutedNodes.map((node) => ({
      ...node,
      selected: node.id === selectedEntity?.id,
      data: {
        name: node.data.name as string,
        fields: node.data.fields as EntityNodeData['fields'],
        isFocused: node.id === selectedEntity?.id,
        isConnected: connectedEntityIds.has(node.id),
        isDimmed: Boolean(selectedEntity) && node.id !== selectedEntity?.id &&
          !connectedEntityIds.has(node.id),
      } satisfies EntityNodeData,
    })),
    [layoutedNodes, selectedEntity, connectedEntityIds]
  );

  const edges = useMemo(
    () => layoutedEdges.map((edge) => {
      const isConnected = selectedEntity != null &&
        (edge.source === selectedEntity.id || edge.target === selectedEntity.id);
      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: isConnected ? 'var(--color-signal)' : 'var(--color-trace)',
          strokeWidth: isConnected ? 3 : 1,
          vectorEffect: 'non-scaling-stroke' as const,
          opacity: selectedEntity && !isConnected ? 'var(--motion-opacity-secondary)' : 1,
          transition: 'stroke var(--motion-fast) var(--motion-ease-standard), '
            + 'stroke-width var(--motion-fast) var(--motion-ease-standard), '
            + 'opacity var(--motion-fast) var(--motion-ease-standard)',
        },
        labelStyle: {
          ...edge.labelStyle,
          fill: isConnected ? 'var(--color-text)' : 'var(--color-text-muted)',
          opacity: 1,
        },
        labelBgStyle: {
          fill: isConnected
            ? 'color-mix(in srgb, var(--color-signal) 12%, var(--color-surface-raised))'
            : 'var(--color-surface-raised)',
          fillOpacity: 1,
        },
      };
    }),
    [layoutedEdges, selectedEntity]
  );

  const connections = useMemo(() => {
    if (!inspectorEntityId) return [];
    const nameById = new Map(dataModel.entities.map((entity) => [entity.id, entity.name]));

    return dataModel.relations
      .filter(
        (relation) => relation.from === inspectorEntityId || relation.to === inspectorEntityId
      )
      .map((relation) => {
        const isOutgoing = relation.from === inspectorEntityId;
        const connectedId = isOutgoing ? relation.to : relation.from;
        return {
          direction: isOutgoing ? ('out' as const) : ('in' as const),
          label: relation.label ? `${relation.type} — ${relation.label}` : relation.type,
          connectedLabel: nameById.get(connectedId) ?? connectedId,
        };
      });
  }, [dataModel.entities, dataModel.relations, inspectorEntityId]);

  return (
    <div
      ref={canvasRef}
      className="h-full"
      onKeyDownCapture={(event) => {
        // Keep React Flow's deferred Escape blur from undoing the focus
        // restored by our controlled inspector selection.
        if (event.key === 'Escape' && selectedEntity &&
          event.target instanceof HTMLElement && event.target.matches('.react-flow__node')) {
          event.preventDefault();
          event.stopPropagation();
          handleCloseInspector();
        }
      }}
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        if (event.key === 'Escape' && selectedEntity) {
          event.preventDefault();
          event.stopPropagation();
          handleCloseInspector();
        } else if (
          (event.key === 'Enter' || event.key === ' ') &&
          event.target instanceof HTMLElement &&
          event.target.matches('.react-flow__node') &&
          event.target.dataset.id
        ) {
          event.preventDefault();
          handleSelectEntity(event.target.dataset.id, event.target);
        }
      }}
    >
      {/* Only actual graph changes remount the flow for fresh measurement.
          Cached viewports disable its native, measurement-aware initial fit. */}
      <ReactFlow
        key={layoutInput}
        className={styles.flow}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView={!initialViewport}
        fitViewOptions={FIT_OPTIONS}
        minZoom={0}
        defaultViewport={initialViewport}
        nodesDraggable={false}
        panOnDrag
        zoomOnPinch
        preventScrolling
        selectionOnDrag={false}
        onMoveStart={(event, viewport) => {
          // User input takes priority over a fit still waiting for measurement.
          if (event && !initialViewport) rememberViewport(viewport);
        }}
        onMoveEnd={(_, viewport) => rememberViewport(viewport)}
        autoPanOnNodeFocus={false}
        onNodeClick={(event, node) => handleSelectEntity(node.id, event.currentTarget as HTMLElement)}
        onPaneClick={() => setSelectedEntityId(null)}
      >
        <Background variant={BackgroundVariant.Dots} color="var(--color-canvas-grid)" gap={24} />
        <Controls className={`${controlStyles.controls} ${styles.controls}`} position="bottom-right"
          showZoom={false} showFitView={false} showInteractive={false}>
          <ControlButton className="react-flow__controls-zoomin" title="Zoom in" aria-label="Zoom in"
            disabled={maxZoomReached} onClick={() => void zoomIn({ duration: controlDuration() })}>
            <PlusIcon size={12} aria-hidden="true" />
          </ControlButton>
          <ControlButton className="react-flow__controls-zoomout" title="Zoom out" aria-label="Zoom out"
            disabled={minZoomReached} onClick={() => void zoomOut({ duration: controlDuration() })}>
            <MinusIcon size={12} aria-hidden="true" />
          </ControlButton>
          <ControlButton className="react-flow__controls-fitview" title="Fit view" aria-label="Fit view"
            onClick={() => void fitView({ ...FIT_OPTIONS, duration: controlDuration() })}>
            <CornersOutIcon size={12} aria-hidden="true" />
          </ControlButton>
          <ControlButton className="react-flow__controls-interactive" aria-pressed={!interactive}
            title={interactive ? 'Lock interactions' : 'Unlock interactions'}
            aria-label={interactive ? 'Lock interactions' : 'Unlock interactions'} onClick={() => {
              const state = store.getState();
              const enabled = state.nodesDraggable || state.nodesConnectable || state.elementsSelectable;
              store.setState({ nodesDraggable: false, nodesConnectable: !enabled, elementsSelectable: !enabled });
            }}>
            {interactive ? <LockOpenIcon size={12} aria-hidden="true" /> : <LockIcon size={12} aria-hidden="true" />}
          </ControlButton>
        </Controls>
      </ReactFlow>

      <NodeInspector
        isOpen={Boolean(selectedEntity)}
        label={inspectorEntity?.name ?? ''}
        type="Entity"
        connections={connections}
        onClose={handleCloseInspector}
      />
    </div>
  );
}

export function DatabaseCanvas(props: DatabaseCanvasProps) {
  return (
    <div className={`relative h-[600px] w-full overflow-hidden rounded-lg border border-canvas-grid bg-canvas ${styles.canvas}`}>
      <ReactFlowProvider>
        <DatabaseCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
