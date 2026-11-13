'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  ControlButton,
  Panel,
  useReactFlow,
  useStore,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import controlStyles from './CanvasControls.module.css';
import { CircleNotchIcon, CornersOutIcon, MagnifyingGlassIcon, TextAaIcon } from '@phosphor-icons/react';
import { ARCHITECTURE_INITIAL_MAX_ZOOM, ARCHITECTURE_MIN_ZOOM, getArchitectureLayout, getArchitectureViewport, getArchitectureInitialViewport } from '@/lib/architecture-layout';
import { ArchitectureEdge } from './ArchitectureEdge';
import { ArchitectureNode, type ArchitectureNodeData } from './nodes/ArchitectureNode';
import { NodeInspector } from './NodeInspector';
import { ArchitectureReview } from './ArchitectureReview';
import { IterationBar } from './IterationBar';
import { DiffView } from './DiffView';
import styles from './ArchitectureCanvas.module.css';
import { useGeneratedArtifact } from '@/lib/use-generated-artifact';
import { ArtifactStatus } from './ArtifactSafety';
import { architectureDisplayBounds, architectureLayoutKey, type ArchitectureCanvasMemory } from '@/lib/architecture-canvas-memory';
import {
  ApiError,
  getArchitectureReview,
  getDiff,
  runArchitectureReview,
  setFindingDismissed,
  type DiffResult,
  type MapprSystem,
} from '@/lib/api';

const nodeTypes = { architecture: ArchitectureNode };
const edgeTypes = { architecture: ArchitectureEdge };
const defaultViewport = { x: 0, y: 0, zoom: ARCHITECTURE_INITIAL_MAX_ZOOM };

type ArchitectureCanvasProps = {
  mapId: string;
  architecture: MapprSystem['architecture'];
  canonicalRevision?: number | null;
  selectedNodeId: string | null;
  onSelectedNodeChange: (id: string | null) => void;
  viewState: ArchitectureCanvasMemory;
  onViewStateChange: (update: (previous: ArchitectureCanvasMemory) => ArchitectureCanvasMemory) => void;
};

function ArchitectureCanvasInner({ mapId, architecture, canonicalRevision, selectedNodeId, onSelectedNodeChange, viewState, onViewStateChange }: ArchitectureCanvasProps) {
  const [initialViewport] = useState(() => viewState.viewport ?? defaultViewport);
  const [restoredViewport] = useState(() => !!viewState.viewport);
  const lastCanvasSize = useRef<string | null>(null);
  // Preserve panel contents during exit, independently of active selection.
  const [inspectorNodeId, setInspectorNodeId] = useState<string | null>(selectedNodeId);
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);

  const handleSelectNode = useCallback((id: string, trigger: HTMLElement) => {
    inspectorTriggerRef.current = trigger;
    onSelectedNodeChange(id);
    setInspectorNodeId(id);
  }, [onSelectedNodeChange]);

  const handleCloseInspector = useCallback(() => {
    onSelectedNodeChange(null);
    if (inspectorTriggerRef.current?.isConnected) {
      inspectorTriggerRef.current.focus({ preventScroll: true });
    }
  }, [onSelectedNodeChange]);

  const reviewArtifact = useGeneratedArtifact({ mapId, kind: 'critique', load: getArchitectureReview, generate: runArchitectureReview,
    loadError: 'The saved review is unavailable.', generationError: 'The review outcome could not be confirmed.', exportError: 'Review export is unavailable.' });
  const { record: savedReview, safety: reviewSafety, isRunning: isRunningReview, isLoading: isLoadingReview,
    error: reviewError, resultRevision: reviewRevision, runGeneration: runReview, runReload: reloadReview, runMutation: mutateReview } = reviewArtifact;
  const review = !reviewSafety.inspection && reviewSafety.status === 'current' ? savedReview : null;
  // Visibility follows user actions, never saved data or request completion.
  const [isReviewPanelOpen, setIsReviewPanelOpen] = useState(false);
  const reviewErrorKind = reviewError ? 'load' : null;
  const hasCompletedReview = reviewRevision > 0 && reviewSafety.status === 'current';
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  const reviewContentRef = useRef<HTMLSpanElement>(null);
  const restoreReviewFocusRef = useRef(false);
  const isReviewPending = isRunningReview || isLoadingReview;
  const reviewActionLabel = isLoadingReview ? 'Loading review...'
    : isRunningReview ? 'Reviewing...'
    : reviewError ? 'Retry loading'
    : reviewSafety.inspection && savedReview ? 'View saved review'
    : review ? isReviewPanelOpen ? 'Review again' : 'View review' : 'Run Architecture Review';

  useLayoutEffect(() => {
    const button = reviewTriggerRef.current, content = reviewContentRef.current;
    if (!button || !content) return;
    // Normal width follows the current icon/label. Pending width matches the
    // unchanged height, allowing CSS to interpolate to a centered circle.
    const updateWidth = () => {
      const style = getComputedStyle(button);
      const horizontalSpace = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
        + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
      const width = isReviewPending ? button.getBoundingClientRect().height
        : Math.ceil(content.getBoundingClientRect().width + horizontalSpace);
      button.style.width = `${width}px`;
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(content);
    return () => observer.disconnect();
  }, [isReviewPending, reviewActionLabel]);

  useEffect(() => {
    if (isRunningReview || isLoadingReview || !restoreReviewFocusRef.current) return;
    restoreReviewFocusRef.current = false;
    if (document.activeElement === document.body && reviewTriggerRef.current?.isConnected) {
      reviewTriggerRef.current.focus({ preventScroll: true });
    }
  }, [isRunningReview, isLoadingReview]);

  const [iterationError, setIterationError] = useState<string | null>(null);

  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isDiffing, setIsDiffing] = useState(false);

  const loadSavedReview = useCallback(async () => {
    await reloadReview(reviewTriggerRef.current ?? undefined);
  }, [reloadReview]);

  const handleRunReview = useCallback(async () => {
    if (isRunningReview || isLoadingReview || !reviewTriggerRef.current) return;
    restoreReviewFocusRef.current = document.activeElement === reviewTriggerRef.current;
    setIsReviewPanelOpen(true);
    setDiffResult(null);
    setActiveFindingId(null);
    await runReview(reviewTriggerRef.current);
  }, [isRunningReview, isLoadingReview, runReview]);

  const handleDismissFinding = useCallback(async (findingId: string, dismissed: boolean) => {
    if (!reviewSafety.canExport) return;
    if (activeFindingId === findingId && dismissed) setActiveFindingId(null);
    await mutateReview(() => setFindingDismissed(mapId, findingId, dismissed));
  }, [reviewSafety.canExport, activeFindingId, mutateReview, mapId]);


  const handleCompare = useCallback(
    async (from: number, to: number) => {
      setIsDiffing(true);
      setIsReviewPanelOpen(false); // left-side panels are mutually exclusive
      try {
        const result = await getDiff(mapId, from, to);
        setDiffResult(result);
      } catch (err) {
        setIterationError(
          err instanceof ApiError ? (err.body.message ?? err.body.error) : 'Failed to load diff.'
        );
      } finally {
        setIsDiffing(false);
      }
    },
    [mapId]
  );

  const activeFinding = useMemo(
    () => review?.findings.find((f) => f.id === activeFindingId) ?? null,
    [review, activeFindingId]
  );

  const highlightedNodeIds = useMemo(
    () => new Set(activeFinding?.affectedNodeIds ?? []),
    [activeFinding]
  );

  const layoutInput = architectureLayoutKey(architecture);
  const { nodes: layoutedNodes, edges: layoutedEdges, bounds: routedBounds } = useMemo(() => {
    const input = JSON.parse(layoutInput) as { nodes: { id: string }[]; edges: MapprSystem['architecture']['edges'] };
    const rawNodes: Node[] = input.nodes.map(({ id }) => ({
      id, type: 'architecture', data: {}, position: { x: 0, y: 0 },
    }));
    const rawEdges: Edge[] = input.edges.map((edge, index) => ({
      id: `${edge.from}-${edge.to}-${index}`, type: 'architecture', source: edge.from, target: edge.to,
      label: edge.label, style: { stroke: 'var(--color-trace)' }, labelStyle: { fill: 'var(--color-text-muted)', fontSize: 10 },
    }));
    return getArchitectureLayout(rawNodes, rawEdges);
  }, [layoutInput]);
  const bounds = useMemo(() => architectureDisplayBounds(routedBounds, layoutedNodes, viewState.positions), [routedBounds, layoutedNodes, viewState.positions]);

  const { setViewport, viewportInitialized } = useReactFlow();
  const canvasWidth = useStore((state) => state.width);
  const canvasHeight = useStore((state) => state.height);
  const fitGraph = useCallback(() => {
    if (!viewportInitialized || !canvasWidth || !canvasHeight || !bounds.width || !bounds.height) return;
    void setViewport(getArchitectureViewport(bounds, canvasWidth, canvasHeight));
  }, [bounds, canvasWidth, canvasHeight, setViewport, viewportInitialized]);

  const resetReadableView = useCallback(() => {
    if (!viewportInitialized || !canvasWidth || !canvasHeight || !bounds.width || !bounds.height) return;
    void setViewport(getArchitectureInitialViewport(bounds, canvasWidth, canvasHeight));
  }, [bounds, canvasWidth, canvasHeight, setViewport, viewportInitialized]);

  // Fit once or after an actual canvas resize. Preview/Apply and topology edits
  // preserve the user's camera; explicit Fit/Readable controls remain available.
  useEffect(() => {
    if (!viewportInitialized || !canvasWidth || !canvasHeight || !bounds.width || !bounds.height) return;
    const size = `${canvasWidth}:${canvasHeight}`;
    if (lastCanvasSize.current === null ? !restoredViewport : lastCanvasSize.current !== size) resetReadableView();
    lastCanvasSize.current = size;
  }, [resetReadableView, restoredViewport, viewportInitialized, canvasWidth, canvasHeight, bounds.width, bounds.height]);

  const selectedNode = useMemo(
    () => architecture.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [architecture.nodes, selectedNodeId]
  );

  const inspectorNode = useMemo(
    () => architecture.nodes.find((node) => node.id === inspectorNodeId) ?? null,
    [architecture.nodes, inspectorNodeId]
  );

  const connectedNodeIds = useMemo(() => {
    const connected = new Set<string>();
    if (!selectedNode) return connected;

    for (const edge of architecture.edges) {
      if (edge.from === selectedNode.id) connected.add(edge.to);
      if (edge.to === selectedNode.id) connected.add(edge.from);
    }
    return connected;
  }, [architecture.edges, selectedNode]);

  // Apply focus and review indicators AFTER layout. A selected node and its
  // relationships become clearer without moving any graph elements.
  const nodes = useMemo(
    () => layoutedNodes.map((node) => ({
      ...node,
      position: viewState.positions[node.id] ?? node.position,
      selected: selectedNode?.id === node.id,
      data: {
        ...node.data,
        label: architecture.nodes.find((item) => item.id === node.id)?.label ?? node.id,
        type: architecture.nodes.find((item) => item.id === node.id)?.type ?? '',
        highlightSeverity: highlightedNodeIds.has(node.id) ? activeFinding?.severity : undefined,
        isFocused: selectedNode?.id === node.id,
        isConnected: connectedNodeIds.has(node.id),
        isDimmed: Boolean(selectedNode) &&
          selectedNode?.id !== node.id &&
          !connectedNodeIds.has(node.id) &&
          !highlightedNodeIds.has(node.id),
      } satisfies ArchitectureNodeData,
    })),
    [layoutedNodes, highlightedNodeIds, activeFinding, selectedNode, connectedNodeIds, architecture.nodes, viewState.positions]
  );

  const edges = useMemo(
    () => layoutedEdges.map((edge) => {
      const isConnected = selectedNode != null &&
        (edge.source === selectedNode.id || edge.target === selectedNode.id);
      const isDimmed = selectedNode != null && !isConnected;

      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: isConnected ? 'var(--color-signal)' : 'var(--color-trace)',
          strokeWidth: isConnected ? 3 : 1,
          vectorEffect: 'non-scaling-stroke' as const,
          opacity: isDimmed ? 'var(--motion-opacity-secondary)' : 1,
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
    [layoutedEdges, selectedNode]
  );

  const connections = useMemo(() => {
    if (!inspectorNodeId) return [];
    const labelById = new Map(architecture.nodes.map((node) => [node.id, node.label]));

    return architecture.edges
      .filter((edge) => edge.from === inspectorNodeId || edge.to === inspectorNodeId)
      .map((edge) => {
        const isOutgoing = edge.from === inspectorNodeId;
        const connectedId = isOutgoing ? edge.to : edge.from;
        return {
          direction: isOutgoing ? ('out' as const) : ('in' as const),
          label: edge.label,
          connectedLabel: labelById.get(connectedId) ?? connectedId,
        };
      });
  }, [architecture.edges, architecture.nodes, inspectorNodeId]);

  return (
    <div
      className="h-full"
      onKeyDownCapture={(event) => {
        // React Flow otherwise schedules a node blur after Escape, undoing
        // our focus restoration on the next animation frame.
        if (event.key === 'Escape' && selectedNode &&
          event.target instanceof HTMLElement && event.target.matches('.react-flow__node')) {
          event.preventDefault();
          event.stopPropagation();
          handleCloseInspector();
        }
      }}
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        if (event.key === 'Escape' && selectedNode) {
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
          handleSelectNode(event.target.dataset.id, event.target);
        }
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={ARCHITECTURE_MIN_ZOOM}
        defaultViewport={initialViewport}
        onMoveEnd={(_, viewport) => onViewStateChange((previous) => ({ ...previous, viewport }))}
        onNodesChange={(changes) => onViewStateChange((previous) => {
          let positions: ArchitectureCanvasMemory['positions'] | null = null;
          for (const change of changes) {
            if (change.type !== 'position' || !change.position) continue;
            const old = previous.positions[change.id];
            if (old?.x === change.position.x && old?.y === change.position.y) continue;
            positions ??= { ...previous.positions };
            positions[change.id] = { ...change.position };
          }
          return positions ? { ...previous, positions } : previous;
        })}
        autoPanOnNodeFocus={false}
        onNodeClick={(event, node) => handleSelectNode(node.id, event.currentTarget as HTMLElement)}
        onPaneClick={() => onSelectedNodeChange(null)}
      >
        <Background variant={BackgroundVariant.Dots} color="var(--color-canvas-grid)" gap={24} />
        <Controls className={controlStyles.controls} showFitView={false} position="bottom-right">
          <ControlButton className="react-flow__controls-fitview" onClick={fitGraph}
            title="Fit entire graph (may reduce text size)" aria-label="Fit entire graph">
            <CornersOutIcon size={12} />
          </ControlButton>
          <ControlButton onClick={resetReadableView} title="Readable view" aria-label="Readable view">
            <TextAaIcon size={14} />
          </ControlButton>
        </Controls>
        <Panel position="top-right" style={{ maxWidth: 'calc(100% - 24px)' }}>
          <div className="flex max-w-72 flex-col items-end gap-2">
            <button
              ref={reviewTriggerRef}
              data-review-action
              type="button"
              disabled={isReviewPending}
              aria-busy={isReviewPending}
              aria-label={isReviewPending ? reviewActionLabel : undefined}
              data-state={isReviewPending ? 'pending' : reviewError ? 'error' : hasCompletedReview ? 'success' : 'idle'}
              className={`${styles.reviewAction} font-mono`}
              onClick={() => {
                if (reviewErrorKind === 'load') {
                  restoreReviewFocusRef.current = document.activeElement === reviewTriggerRef.current;
                  void loadSavedReview();
                } else if (reviewSafety.inspection && savedReview || review && !isReviewPanelOpen && !reviewError) {
                  setDiffResult(null);
                  setActiveFindingId(null);
                  setIsReviewPanelOpen(true);
                } else {
                  void handleRunReview();
                }
              }}
              aria-expanded={isReviewPanelOpen}
            >
              <span ref={reviewContentRef} className={styles.reviewActionContent} aria-live="polite" aria-atomic="true">
                {isReviewPending ? <>
                  <CircleNotchIcon size={14} weight="bold" className={styles.reviewSpinner} aria-hidden="true" />
                  <span className="sr-only">{reviewActionLabel}</span>
                </> : <>
                  <MagnifyingGlassIcon size={14} weight="bold" aria-hidden="true" />
                  <span>{reviewActionLabel}</span>
                </>}
              </span>
            </button>
            <ArtifactStatus safety={reviewSafety} />
            {reviewError && !isReviewPanelOpen && (
              <div role="alert" className="rounded-lg border border-danger bg-surface px-3 py-2 font-body text-xs text-danger">
                {reviewError}
              </div>
            )}
          </div>
        </Panel>
        <Panel position="bottom-center">
          <IterationBar
            mapId={mapId}
            historyOnly
            isRunning={false}
            error={iterationError}
            lastSummary={null}
            refreshKey={canonicalRevision ?? 0}
            onCompare={handleCompare}
            isDiffing={isDiffing}
          />
        </Panel>
      </ReactFlow>

      {isReviewPanelOpen && (
        <ArchitectureReview
          findings={review?.findings ?? []}
          inspection={reviewSafety.inspection ? savedReview : null}
          hasReview={Boolean(review)}
          revision={reviewRevision}
          error={reviewError}
          activeFindingId={activeFindingId}
          onSelectFinding={setActiveFindingId}
          onDismissFinding={handleDismissFinding}
          onClose={() => {
            setIsReviewPanelOpen(false);
            setActiveFindingId(null);
            restoreReviewFocusRef.current = Boolean(reviewTriggerRef.current?.disabled);
            reviewTriggerRef.current?.focus({ preventScroll: true });
          }}
          isRunning={isRunningReview}
        />
      )}

      {diffResult && (
        <DiffView
          diff={diffResult.diff}
          from={diffResult.from}
          to={diffResult.to}
          onClose={() => setDiffResult(null)}
        />
      )}

      <NodeInspector
        className="bottom-0 top-14"
        isOpen={Boolean(selectedNode)}
        label={inspectorNode?.label ?? ''}
        type={inspectorNode?.type ?? ''}
        description={inspectorNode?.description}
        connections={connections}
        onClose={handleCloseInspector}
      />
    </div>
  );
}

export function ArchitectureCanvas(props: ArchitectureCanvasProps) {
  return (
    <div className={`${styles.canvas} mappr-architecture-canvas relative w-full overflow-hidden rounded-lg border border-canvas-grid bg-canvas`}>
      <ReactFlowProvider key={props.mapId}>
        <ArchitectureCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
