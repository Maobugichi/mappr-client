'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import type { FindingSeverity, MapprSystem, RequirementsReview } from '@/lib/api';
import {
  ApiError,
  getRequirementsReview,
  runRequirementsReview,
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

export function Overview({
  mapId,
  product,
  features,
}: {
  mapId: string;
  product: MapprSystem['product'];
  features: MapprSystem['features'];
}) {
  const nameById = new Map(features.map((feature) => [feature.id, feature.name]));

  const [review, setReview] = useState<RequirementsReview | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);

  // Load any previously persisted review on mount — same convention as
  // ArchitectureCanvas.tsx, so reopening a map doesn't re-run (and
  // re-pay for) a check that already exists.
  useEffect(() => {
    let cancelled = false;
    getRequirementsReview(mapId).then((existing) => {
      if (cancelled || !existing) return;
      setReview(existing);
      setIsPanelOpen(true);
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

  const activeFinding = useMemo(
    () => review?.findings.find((f) => f.id === activeFindingId) ?? null,
    [review, activeFindingId]
  );

  const highlightedFeatureIds = useMemo(
    () => new Set(activeFinding?.relatedFeatureIds ?? []),
    [activeFinding]
  );

  const activeFindingsCount = review?.findings.filter((f) => !f.dismissed).length ?? 0;

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

        <button
          onClick={handleRun}
          disabled={isRunning}
          className="flex shrink-0 items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <MagnifyingGlassIcon size={14} weight="bold" />
          {isRunning
            ? 'Checking…'
            : review
              ? `Re-run Check${activeFindingsCount > 0 ? ` (${activeFindingsCount})` : ''}`
              : 'Run Requirements Check'}
        </button>
      </section>

      {error && (
        <div className="rounded-lg border border-danger bg-surface px-4 py-2 font-body text-xs text-danger">
          {error}
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
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}