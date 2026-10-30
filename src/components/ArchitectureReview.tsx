'use client';

import { CaretDownIcon, CaretUpIcon, XIcon, EyeIcon, LightbulbIcon, SparkleIcon } from '@phosphor-icons/react';
import { useId, useRef } from 'react';
import type { ArchitectureFinding, FindingSeverity } from '@/lib/api';
import { MotionDisclosure } from './MotionDisclosure';
import styles from './ArchitectureReview.module.css';

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

// Matches the token choices in ArchitectureNode.tsx so a finding's
// severity reads the same way in the list as it does on the canvas.
const SEVERITY_DOT: Record<FindingSeverity, string> = {
  low: 'bg-trace',
  medium: 'bg-severity-medium',
  high: 'bg-danger',
  critical: 'bg-danger',
};

const OBSERVATION_ICON = {
  observed: EyeIcon,
  inferred: LightbulbIcon,
  recommended: SparkleIcon,
};

const OBSERVATION_LABEL = {
  observed: 'Observed',
  inferred: 'Inferred',
  recommended: 'Recommended',
};

const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'high', 'medium', 'low'];

type ArchitectureReviewProps = {
  findings: ArchitectureFinding[];
  activeFindingId: string | null;
  onSelectFinding: (findingId: string | null) => void;
  onDismissFinding: (findingId: string, dismissed: boolean) => void;
  onClose: () => void;
  isRunning: boolean;
  hasReview?: boolean;
  revision?: number;
  error?: string | null;
};

export function ArchitectureReview({
  findings,
  activeFindingId,
  onSelectFinding,
  onDismissFinding,
  onClose,
  isRunning,
  hasReview = true,
  revision = 0,
  error,
}: ArchitectureReviewProps) {
  const findingIdPrefix = useId();
  const closeTriggerRef = useRef<HTMLButtonElement>(null);
  const handleDismiss = (trigger: HTMLButtonElement, findingId: string, dismissed: boolean) => {
    // Dismiss/restore removes its own control. Keep keyboard focus on a
    // stable action instead of leaving it in removed or inert contents.
    if (document.activeElement === trigger) closeTriggerRef.current?.focus({ preventScroll: true });
    onDismissFinding(findingId, dismissed);
  };
  const active = findings.filter((f) => !f.dismissed);
  const dismissed = findings.filter((f) => f.dismissed);
  const sorted = [...active].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <section aria-label="Architecture review" className={`${styles.panel} absolute bottom-0 left-0 top-14 w-96 max-w-full overflow-y-auto border-r border-canvas-grid bg-surface p-5 [overflow-wrap:anywhere]`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
            Architecture Review
          </p>
          {(hasReview || !isRunning) && <h3 aria-live={isRunning ? 'off' : 'polite'} aria-atomic="true" className="font-display text-lg font-semibold text-text">
            {hasReview ? `${active.length} issue${active.length === 1 ? '' : 's'} detected` : 'Review unavailable'}
          </h3>}
        </div>
        <button
          ref={closeTriggerRef}
          onClick={onClose}
          aria-label="Close review"
          className="shrink-0 rounded p-1 text-text-muted hover:bg-surface-raised hover:text-text"
        >
          <XIcon size={16} />
        </button>
      </div>

      <MotionDisclosure isOpen={Boolean(error)}>
        <p role="alert" className="mb-4 rounded-lg border border-danger bg-surface-raised p-3 font-body text-xs text-danger">{error} Use Retry review to try again.</p>
      </MotionDisclosure>

      {hasReview && !isRunning && sorted.length === 0 && (
        <p className="font-body text-sm text-text-muted">
          No open issues. Nothing here is currently flagged.
        </p>
      )}

      <div key={revision} className={hasReview ? styles.results : undefined}>
      <ul aria-busy={isRunning} className="flex flex-col gap-3">
        {sorted.map((finding) => {
          const Icon = OBSERVATION_ICON[finding.observationType];
          const isActive = finding.id === activeFindingId;
          return (
            <li
              key={finding.id}
              className={`rounded-lg border transition-colors duration-(--motion-fast) ${
                isActive
                  ? 'border-signal bg-surface-raised'
                  : 'border-canvas-grid hover:bg-surface-raised'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectFinding(isActive ? null : finding.id)}
                disabled={isRunning}
                aria-expanded={isActive}
                aria-controls={`${findingIdPrefix}-${finding.id}`}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex items-center gap-2">
                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[finding.severity]}`} />
                    <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                      {SEVERITY_LABEL[finding.severity]} · {finding.category.replace('_', ' ')}
                    </span>
                  </span>
                  <span className="block font-display text-sm font-medium text-text">{finding.title}</span>
                </span>
                {isActive ? <CaretUpIcon size={14} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />
                  : <CaretDownIcon size={14} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />}
              </button>

              <MotionDisclosure isOpen={isActive} id={`${findingIdPrefix}-${finding.id}`}>
                <div className="mx-3 mb-3 border-t border-canvas-grid pt-3">
                  <p className="font-body text-xs text-text-muted">{finding.description}</p>
                  <p className="mt-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-muted">
                    <Icon size={12} aria-hidden="true" />
                    {OBSERVATION_LABEL[finding.observationType]}
                  </p>
                  <p className="mb-1 mt-3 font-mono text-[10px] uppercase tracking-wide text-trace">
                    Recommendation
                  </p>
                  <p className="font-body text-xs text-text">{finding.recommendation}</p>
                  <button
                    disabled={isRunning}
                    onClick={(event) => handleDismiss(event.currentTarget, finding.id, true)}
                    className="mt-3 rounded-full border border-canvas-grid px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-text-muted hover:bg-surface hover:text-text"
                  >
                    Dismiss
                  </button>
                </div>
              </MotionDisclosure>
            </li>
          );
        })}
      </ul>

      {dismissed.length > 0 && (
        <div className="mt-5 border-t border-canvas-grid pt-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-muted">
            Dismissed ({dismissed.length})
          </p>
          <ul className="flex flex-col gap-2">
            {dismissed.map((finding) => (
              <li
                key={finding.id}
                className="flex items-center justify-between gap-2 rounded bg-surface-raised px-3 py-2"
              >
                <span className="font-body text-xs text-text-muted line-through">
                  {finding.title}
                </span>
                <button
                  disabled={isRunning}
                  onClick={(event) => handleDismiss(event.currentTarget, finding.id, false)}
                  className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-trace hover:underline"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </section>
  );
}
