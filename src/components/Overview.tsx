'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon, LinkIcon, WrenchIcon, ArrowUpIcon } from '@phosphor-icons/react';
import type { FindingSeverity, MapprSystem, RequirementsReview, TraceabilityReview } from '@/lib/api';
import {
  ApiError,
  getRequirementsReview,
  getTraceability,
  runIteration,
  runRequirementsReview,
  runTraceability,
  setRequirementDismissed,
} from '@/lib/api';
import { MissingRequirements } from './MissingRequirements';

// Reuses the same severity → token mapping as ArchitectureNode.tsx, so a
// flagged feature reads the same way here as a flagged architecture node
// does on the canvas.
const SEVERITY_RING: Record<FindingSeverity, string> = {
  low: 'ring-2 ring-trace',
  medium: 'ring-2 ring-signal',
  high: 'ring-2 ring-danger',
  critical: 'ring-[3px] ring-danger',
};

function defaultFixInstruction(feature: MapprSystem['features'][number]): string {
  return `Add an architecture component for the feature "${feature.name}": ${feature.description}`;
}

export function Overview({
  mapId,
  product,
  features,
  architecture,
  onSystemUpdated,
}: {
  mapId: string;
  product: MapprSystem['product'];
  features: MapprSystem['features'];
  architecture: MapprSystem['architecture'];
  onSystemUpdated: (system: MapprSystem) => void;
}) {
  const nameById = new Map(features.map((feature) => [feature.id, feature.name]));
  const nodeLabelById = new Map(architecture.nodes.map((node) => [node.id, node.label]));

  const [review, setReview] = useState<RequirementsReview | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);

  const [traceability, setTraceability] = useState<TraceabilityReview | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  // Editable-first "fix" flow for an untraced feature: opens an
  // editable instruction pre-filled from the feature, rather than
  // firing an Iteration instruction straight off a click — Iteration
  // changes real architecture data, so a person should see and be able
  // to adjust the wording before it runs.
  const [fixDraftFeatureId, setFixDraftFeatureId] = useState<string | null>(null);
  const [fixInstruction, setFixInstruction] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);

  // Load any previously persisted review/trace on mount — same
  // convention as ArchitectureCanvas.tsx, so reopening a map doesn't
  // re-run (and re-pay for) a check that already exists.
  useEffect(() => {
    let cancelled = false;
    getRequirementsReview(mapId)
      .then((existing) => {
        if (cancelled || !existing) return;
        setReview(existing);
        setIsPanelOpen(true);
      })
      .catch((err) => {
        console.error('Failed to load existing requirements review:', err);
      });
    getTraceability(mapId)
      .then((existing) => {
        if (cancelled || !existing) return;
        setTraceability(existing);
      })
      .catch((err) => {
        console.error('Failed to load existing traceability review:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setIsPanelOpen(true);
    setActiveFindingId(null);
    try {
      const result = await runRequirementsReview(mapId);
      setReview(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong running the requirements check.');
      }
    } finally {
      setIsRunning(false);
    }
  }, [mapId]);

  const handleTrace = useCallback(async () => {
    setIsTracing(true);
    setTraceError(null);
    try {
      const result = await runTraceability(mapId);
      setTraceability(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setTraceError(err.body.message ?? err.body.error);
      } else {
        setTraceError('Something went wrong tracing requirements.');
      }
    } finally {
      setIsTracing(false);
    }
  }, [mapId]);

  const handleDismiss = useCallback(
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
      setRequirementDismissed(mapId, findingId, dismissed)
        .then((result) => setReview(result))
        .catch((err) => {
          console.error('Failed to persist requirement dismissal:', err);
        });
    },
    [mapId, activeFindingId]
  );

  const handleOpenFix = useCallback((feature: MapprSystem['features'][number]) => {
    setFixDraftFeatureId(feature.id);
    setFixInstruction(defaultFixInstruction(feature));
    setFixError(null);
    setFixSuccessMessage(null);
  }, []);

  const handleCancelFix = useCallback(() => {
    setFixDraftFeatureId(null);
    setFixError(null);
  }, []);

  const handleApplyFix = useCallback(async () => {
    const trimmed = fixInstruction.trim();
    if (!trimmed) return;
    setIsFixing(true);
    setFixError(null);
    try {
      const result = await runIteration(mapId, trimmed);
      onSystemUpdated(result.data);
      setFixSuccessMessage(
        `v${result.version}: ${result.summary} — re-trace to confirm this feature is now linked.`
      );
      setFixDraftFeatureId(null);
    } catch (err) {
      setFixError(
        err instanceof ApiError ? (err.body.message ?? err.body.error) : 'Failed to apply the fix.'
      );
    } finally {
      setIsFixing(false);
    }
  }, [mapId, fixInstruction, onSystemUpdated]);

  const activeFinding = useMemo(
    () => review?.findings.find((f) => f.id === activeFindingId) ?? null,
    [review, activeFindingId]
  );

  const highlightedFeatureIds = useMemo(
    () => new Set(activeFinding?.relatedFeatureIds ?? []),
    [activeFinding]
  );

  const activeFindingsCount = review?.findings.filter((f) => !f.dismissed).length ?? 0;

  const linksByFeatureId = useMemo(
    () => new Map((traceability?.links ?? []).map((link) => [link.featureId, link])),
    [traceability]
  );

  // A node is an orphan if it's never referenced by any link's nodeIds —
  // derived here rather than by the backend, since it's a pure
  // set-difference over data already on the page.
  const orphanNodes = useMemo(() => {
    if (!traceability) return [];
    const tracedNodeIds = new Set(traceability.links.flatMap((link) => link.nodeIds));
    return architecture.nodes.filter((node) => !tracedNodeIds.has(node.id));
  }, [traceability, architecture.nodes]);

  return (
    <div className="flex flex-col gap-8 rounded-lg border border-canvas-grid bg-canvas p-6">
      <section className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-base text-text">{product.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {product.concepts.map((concept) => (
              <span
                key={concept}
                className="rounded-full border border-trace/40 px-3 py-1 font-mono text-[11px] text-trace"
              >
                {concept}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <MagnifyingGlassIcon size={14} weight="bold" />
            {isRunning
              ? 'Checking…'
              : review
                ? `Re-run Check${activeFindingsCount > 0 ? ` (${activeFindingsCount})` : ''}`
                : 'Run Requirements Check'}
          </button>
          <button
            onClick={handleTrace}
            disabled={isTracing}
            className="flex items-center gap-2 rounded-full border border-canvas-grid px-4 py-2 font-mono text-xs uppercase tracking-wide text-text-muted shadow-lg transition-colors hover:bg-surface-raised hover:text-text disabled:opacity-60"
          >
            <LinkIcon size={14} weight="bold" />
            {isTracing ? 'Tracing…' : traceability ? 'Re-trace Requirements' : 'Trace Requirements'}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-danger bg-surface px-4 py-2 font-body text-xs text-danger">
          {error}
        </div>
      )}
      {traceError && (
        <div className="rounded-lg border border-danger bg-surface px-4 py-2 font-body text-xs text-danger">
          {traceError}
        </div>
      )}
      {fixSuccessMessage && (
        <div className="rounded-lg border border-canvas-grid bg-surface px-4 py-2 font-body text-xs text-text-muted">
          {fixSuccessMessage}
        </div>
      )}

      {isPanelOpen && review && (
        <MissingRequirements
          findings={review.findings}
          activeFindingId={activeFindingId}
          onSelectFinding={setActiveFindingId}
          onDismissFinding={handleDismiss}
          onClose={() => {
            setIsPanelOpen(false);
            setActiveFindingId(null);
          }}
          isRunning={isRunning}
        />
      )}

      <section>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-text-muted">
          Features
        </p>
        <div className="flex flex-col gap-3">
          {features.map((feature) => {
            const isHighlighted = highlightedFeatureIds.has(feature.id);
            const link = linksByFeatureId.get(feature.id);
            const implementingNodeIds = link?.nodeIds ?? [];
            const isGap = traceability && implementingNodeIds.length === 0;
            const isFixOpen = fixDraftFeatureId === feature.id;

            return (
              <div
                key={feature.id}
                className={`rounded-lg border border-canvas-grid bg-surface-raised p-4 transition-shadow ${
                  isHighlighted && activeFinding ? SEVERITY_RING[activeFinding.severity] : ''
                }`}
              >
                <p className="font-display text-sm font-semibold text-text">{feature.name}</p>
                <p className="mt-1 font-body text-sm text-text-muted">{feature.description}</p>

                {feature.dependsOn.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] text-text-muted">depends on:</span>
                    {feature.dependsOn.map((depId) => (
                      <span
                        key={depId}
                        className="rounded bg-canvas px-2 py-0.5 font-mono text-[10px] text-trace"
                      >
                        {nameById.get(depId) ?? depId}
                      </span>
                    ))}
                  </div>
                )}

                {traceability && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] text-text-muted">implements:</span>
                    {implementingNodeIds.length > 0 ? (
                      implementingNodeIds.map((nodeId) => (
                        <span
                          key={nodeId}
                          className="rounded bg-canvas px-2 py-0.5 font-mono text-[10px] text-success"
                        >
                          {nodeLabelById.get(nodeId) ?? nodeId}
                        </span>
                      ))
                    ) : (
                      <button
                        onClick={() => handleOpenFix(feature)}
                        className="flex items-center gap-1 rounded bg-canvas px-2 py-0.5 font-mono text-[10px] text-danger transition-colors hover:bg-danger/10"
                      >
                        not traced to any component
                        <WrenchIcon size={10} />
                      </button>
                    )}
                  </div>
                )}

                {isGap && isFixOpen && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-canvas-grid pt-3">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-trace">
                      Fix — describe the component to add
                    </p>
                    <div className="flex items-center gap-2 rounded-full border border-canvas-grid bg-canvas px-2 py-1.5">
                      <input
                        value={fixInstruction}
                        onChange={(e) => setFixInstruction(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleApplyFix();
                        }}
                        disabled={isFixing}
                        className="flex-1 bg-transparent font-body text-xs text-text focus:outline-none disabled:opacity-60"
                      />
                      <button
                        onClick={handleCancelFix}
                        disabled={isFixing}
                        className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-muted hover:text-text disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApplyFix}
                        disabled={isFixing || !fixInstruction.trim()}
                        aria-label="Apply fix"
                        className="shrink-0 rounded-full bg-signal p-1 text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        <ArrowUpIcon size={12} weight="bold" />
                      </button>
                    </div>
                    {isFixing && (
                      <p className="font-body text-[11px] text-text-muted">Applying…</p>
                    )}
                    {fixError && <p className="font-body text-[11px] text-danger">{fixError}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {traceability && orphanNodes.length > 0 && (
        <section>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-text-muted">
            Orphan Architecture Nodes
          </p>
          <p className="mb-2 font-body text-xs text-text-muted">
            These components aren&rsquo;t backing any stated feature:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {orphanNodes.map((node) => (
              <span
                key={node.id}
                className="rounded-full border border-canvas-grid px-3 py-1 font-mono text-[11px] text-text-muted"
              >
                {node.label}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}