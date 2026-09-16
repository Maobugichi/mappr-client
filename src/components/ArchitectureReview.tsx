'use client';

import { XIcon, EyeIcon, LightbulbIcon, SparkleIcon } from '@phosphor-icons/react';
import type { ArchitectureFinding, FindingSeverity } from '@/lib/api';

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
  medium: 'bg-signal',
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
};

export function ArchitectureReview({
  findings,
  activeFindingId,
  onSelectFinding,
  onDismissFinding,
  onClose,
  isRunning,
}: ArchitectureReviewProps) {
  const active = findings.filter((f) => !f.dismissed);
  const dismissed = findings.filter((f) => f.dismissed);
  const sorted = [...active].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <div className="absolute left-0 top-0 h-full w-96 overflow-y-auto border-r border-canvas-grid bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
            Architecture Review
          </p>
          <h3 className="font-display text-lg font-semibold text-text">
            {isRunning
              ? 'Running…'
              : `${active.length} issue${active.length === 1 ? '' : 's'} detected`}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close review"
          className="rounded p-1 text-text-muted hover:bg-surface-raised hover:text-text"
        >
          <XIcon size={16} />
        </button>
      </div>

      {isRunning && (
        <p className="font-body text-sm text-text-muted">
          Analyzing the current architecture for coupling, scalability, security, and
          maintainability issues…
        </p>
      )}

      {!isRunning && sorted.length === 0 && (
        <p className="font-body text-sm text-text-muted">
          No open issues. Nothing here is currently flagged.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {sorted.map((finding) => {
          const Icon = OBSERVATION_ICON[finding.observationType];
          const isActive = finding.id === activeFindingId;
          return (
            <li
              key={finding.id}
              onClick={() => onSelectFinding(isActive ? null : finding.id)}
              className={`cursor-pointer rounded-lg border px-3 py-3 transition-colors ${
                isActive
                  ? 'border-signal bg-surface-raised'
                  : 'border-canvas-grid hover:bg-surface-raised'
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${SEVERITY_DOT[finding.severity]}`} />
                <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                  {SEVERITY_LABEL[finding.severity]} · {finding.category.replace('_', ' ')}
                </span>
              </div>

              <p className="font-display text-sm font-medium text-text">{finding.title}</p>
              <p className="mt-1 font-body text-xs text-text-muted">{finding.description}</p>

              <div className="mt-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-muted">
                <Icon size={12} />
                {OBSERVATION_LABEL[finding.observationType]}
              </div>

              {isActive && (
                <div className="mt-3 border-t border-canvas-grid pt-3">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-trace">
                    Recommendation
                  </p>
                  <p className="font-body text-xs text-text">{finding.recommendation}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismissFinding(finding.id, true);
                    }}
                    className="mt-3 rounded-full border border-canvas-grid px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-text-muted hover:bg-surface hover:text-text"
                  >
                    Dismiss
                  </button>
                </div>
              )}
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
                  onClick={() => onDismissFinding(finding.id, false)}
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
  );
}