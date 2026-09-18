'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { getLayoutedElements } from '@/lib/layout';
import { ArchitectureNode, type ArchitectureNodeData } from './nodes/ArchitectureNode';
import { NodeInspector } from './NodeInspector';
import { ArchitectureReview } from './ArchitectureReview';
import { IterationBar } from './IterationBar';
import {
  ApiError,
  getArchitectureReview,
  runArchitectureReview,
  runIteration,
  setFindingDismissed,
  type ArchitectureReview as ArchitectureReviewData,
  type MapprSystem,
} from '@/lib/api';

const nodeTypes = { architecture: ArchitectureNode };

type ArchitectureCanvasProps = {
  mapId: string;
  architecture: MapprSystem['architecture'];
  onSystemUpdated: (system: MapprSystem) => void;
};

function ArchitectureCanvasInner({ mapId, architecture, onSystemUpdated }: ArchitectureCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [review, setReview] = useState<ArchitectureReviewData | null>(null);
  const [isReviewPanelOpen, setIsReviewPanelOpen] = useState(false);
  const [isRunningReview, setIsRunningReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);

  const [isIterating, setIsIterating] = useState(false);
  const [iterationError, setIterationError] = useState<string | null>(null);
  const [lastIterationSummary, setLastIterationSummary] = useState<string | null>(null);
  const [versionRefreshKey, setVersionRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getArchitectureReview(mapId)
      .then((existing) => {
        if (cancelled || !existing) return;
        setReview(existing);
        setIsReviewPanelOpen(true);
      })
      .catch((err) => {
        console.error('Failed to load existing architecture review:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  const handleRunReview = useCallback(async () => {
    setIsRunningReview(true);
    setReviewError(null);
    setIsReviewPanelOpen(true);
    setActiveFindingId(null);
    try {
      const result = await runArchitectureReview(mapId);
      setReview(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setReviewError(err.body.message ?? err.body.error);
      } else {
        setReviewError('Something went wrong running the review.');
      }
    } finally {
      setIsRunningReview(false);
    }
  }, [mapId]);

  const handleDismissFinding = useCallback(
    (findingId: string, dismissed: boolean) => {
      setReview((prev) =>
        prev
          ? {
              ...prev,
              findings: prev.findings.map((f) =>
                f.id === findingId ? { ...f, dismissed } : f
              ),
            }
          : prev
      );
      if (activeFindingId === findingId && dismissed) {
        setActiveFindingId(null);
      }
      setFindingDismissed(mapId, findingId, dismissed)
        .then((result) => setReview(result))
        .catch((err) => {
          console.error('Failed to persist finding dismissal:', err);
        });
    },
    [mapId, activeFindingId]
  );

  const handleIterate = useCallback(
    async (instruction: string) => {
      setIsIterating(true);
      setIterationError(null);
      try {
        const result = await runIteration(mapId, instruction);
        setLastIterationSummary(`v${result.version}: ${result.summary}`);
        setVersionRefreshKey((k) => k + 1);
        onSystemUpdated(result.data);
      } catch (err) {
        if (err instanceof ApiError) {
          setIterationError(err.body.message ?? err.body.error);
        } else {
          setIterationError('Something went wrong applying that change.');
        }
      } finally {
        setIsIterating(false);
      }
    },
    [mapId, onSystemUpdated]
  );

  const activeFinding = useMemo(
    () => review?.findings.find((f) => f.id === activeFindingId) ?? null,
    [review, activeFindingId]
  );

  const highlightedNodeIds = useMemo(
    () => new Set(activeFinding?.affectedNodeIds ?? []),
    [activeFinding]
  );

  const { nodes, edges } = useMemo(() => {
    const rawNodes: Node[] = architecture.nodes.map((node) => {
      const data: ArchitectureNodeData = {
        label: node.label,
        type: node.type,
        highlightSeverity: highlightedNodeIds.has(node.id) ? activeFinding?.severity : undefined,
      };
      return {
        id: node.id,
        type: 'architecture',
        data,
        position: { x: 0, y: 0 },
      };
    });

    const rawEdges: Edge[] = architecture.edges.map((edge, index) => ({
      id: `${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      style: { stroke: 'var(--color-trace)' },
      labelStyle: { fill: 'var(--color-text-muted)', fontSize: 10 },
    }));

    return getLayoutedElements(rawNodes, rawEdges, 'TB');
  }, [architecture, highlightedNodeIds, activeFinding]);

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

  const activeFindingsCount = review?.findings.filter((f) => !f.dismissed).length ?? 0;

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
        <Panel position="top-right">
          <button
            onClick={handleRunReview}
            disabled={isRunningReview}
            className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <MagnifyingGlassIcon size={14} weight="bold" />
            {isRunningReview
              ? 'Reviewing…'
              : review
                ? `Re-run Review${activeFindingsCount > 0 ? ` (${activeFindingsCount})` : ''}`
                : 'Run Architecture Review'}
          </button>
        </Panel>
        {reviewError && (
          <Panel position="top-center">
            <div className="rounded-lg border border-danger bg-surface px-4 py-2 font-body text-xs text-danger">
              {reviewError}
            </div>
          </Panel>
        )}
        <Panel position="bottom-center">
          <IterationBar
            mapId={mapId}
            onSubmit={handleIterate}
            isRunning={isIterating}
            error={iterationError}
            lastSummary={lastIterationSummary}
            refreshKey={versionRefreshKey}
          />
        </Panel>
      </ReactFlow>

      {isReviewPanelOpen && review && (
        <ArchitectureReview
          findings={review.findings}
          activeFindingId={activeFindingId}
          onSelectFinding={setActiveFindingId}
          onDismissFinding={handleDismissFinding}
          onClose={() => {
            setIsReviewPanelOpen(false);
            setActiveFindingId(null);
          }}
          isRunning={isRunningReview}
        />
      )}

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