'use client';

import { XIcon } from '@phosphor-icons/react';
import type { FindingSeverity, MissingRequirement, RequirementCategory } from '@/lib/api';

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

// Matches the token choices in ArchitectureNode.tsx/ArchitectureReview.tsx
// so severity reads the same way across both review types.
const SEVERITY_DOT: Record<FindingSeverity, string> = {
  low: 'bg-trace',
  medium: 'bg-signal',
  high: 'bg-danger',
  critical: 'bg-danger',
};

const CATEGORY_LABEL: Record<RequirementCategory, string> = {
  auth: 'Auth',
  data_integrity: 'Data Integrity',
  error_handling: 'Error Handling',
  compliance: 'Compliance',
  notifications: 'Notifications',
  edge_case: 'Edge Case',
  non_functional: 'Non-Functional',
  other: 'Other',
};

const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'high', 'medium', 'low'];

type MissingRequirementsProps = {
  findings: MissingRequirement[];
  activeFindingId: string | null;
  onSelectFinding: (findingId: string | null) => void;
  onDismissFinding: (findingId: string, dismissed: boolean) => void;
  onClose: () => void;
  isRunning: boolean;
};

export function MissingRequirements({
  findings,
  activeFindingId,
  onSelectFinding,
  onDismissFinding,
  onClose,
  isRunning,
}: MissingRequirementsProps) {
  const active = findings.filter((f) => !f.dismissed);
  const dismissed = findings.filter((f) => f.dismissed);
  const sorted = [...active].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <div className="w-full rounded-lg border border-canvas-grid bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
            Requirements Check
          </p>
          <h3 className="font-display text-lg font-semibold text-text">
            {isRunning
              ? 'Running…'
              : `${active.length} gap${active.length === 1 ? '' : 's'} found`}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close requirements check"
          className="rounded p-1 text-text-muted hover:bg-surface-raised hover:text-text"
        >
          <XIcon size={16} />
        </button>
      </div>

      {isRunning && (
        <p className="font-body text-sm text-text-muted">
          Checking the feature set for missing auth flows, error handling, edge cases, and
          related gaps…
        </p>
      )}

      {!isRunning && sorted.length === 0 && (
        <p className="font-body text-sm text-text-muted">
          No open gaps. Nothing here is currently flagged.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {sorted.map((finding) => {
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
                  {SEVERITY_LABEL[finding.severity]} · {CATEGORY_LABEL[finding.category]}
                </span>
              </div>

              <p className="font-display text-sm font-medium text-text">{finding.title}</p>
              <p className="mt-1 font-body text-xs text-text-muted">{finding.description}</p>

              {isActive && (
                <div className="mt-3 border-t border-canvas-grid pt-3">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-trace">
                    Suggested feature
                  </p>
                  <p className="font-display text-xs font-semibold text-text">
                    {finding.suggestedFeature.name}
                  </p>
                  <p className="mt-0.5 font-body text-xs text-text-muted">
                    {finding.suggestedFeature.description}
                  </p>
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