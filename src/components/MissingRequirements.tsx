'use client';

import { ArrowRightIcon, CaretDownIcon } from '@phosphor-icons/react';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { FindingSeverity, MissingRequirement, RequirementCategory } from '@/lib/api';
import { OverviewDisclosure } from './OverviewDisclosure';
import styles from './Overview.module.css';

const SEVERITY_DOT: Record<FindingSeverity, string> = {
  low: 'bg-trace', medium: 'bg-severity-medium', high: 'bg-danger', critical: 'bg-danger',
};
const CATEGORY_LABEL: Record<RequirementCategory, string> = {
  auth: 'Auth', data_integrity: 'Data Integrity', error_handling: 'Error Handling',
  compliance: 'Compliance', notifications: 'Notifications', edge_case: 'Edge Case',
  non_functional: 'Non-Functional', other: 'Other',
};
const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'high', 'medium', 'low'];

export function MissingRequirements({
  findings, activeFindingId, onSelectFinding, onDismissFinding, isRunning,
  disabled, hasReview, error, action, featureNames, onRevealFeature,
}: {
  findings: MissingRequirement[];
  activeFindingId: string | null;
  onSelectFinding: (findingId: string | null) => void;
  onDismissFinding: (findingId: string, dismissed: boolean) => void;
  isRunning: boolean;
  disabled: boolean;
  hasReview: boolean;
  error: string | null;
  action: ReactNode;
  featureNames: Map<string, string>;
  onRevealFeature: (featureId: string) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => {
      const top = parseFloat(getComputedStyle(panel).getPropertyValue('--overview-sticky-top')) || 24;
      // Oversized panels stay in document flow; never add a nested scroller.
      panel.dataset.fitsViewport = String(panel.getBoundingClientRect().height <= window.innerHeight - top - 16);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  const findingIdPrefix = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const handleDismiss = (trigger: HTMLButtonElement, findingId: string, dismissed: boolean) => {
    // The action leaves the document after dismissal/restore. Move focus to
    // the stable heading before its contents become inert or unmount.
    if (document.activeElement === trigger) headingRef.current?.focus({ preventScroll: true });
    onDismissFinding(findingId, dismissed);
  };
  const active = findings.filter((finding) => !finding.dismissed);
  const dismissed = findings.filter((finding) => finding.dismissed);
  const sorted = [...active].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

  return (
    <section ref={panelRef} aria-labelledby={`${findingIdPrefix}-heading`} aria-busy={isRunning} className={styles.requirements}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>What needs attention</p>
          <h2 id={`${findingIdPrefix}-heading`} ref={headingRef} tabIndex={-1} className={styles.sectionTitle}>Requirements gaps</h2>
        </div>
        {action}
      </div>
      <p className={styles.sectionHint}>Findings in the stated feature set. Open a gap to review its suggestion.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!hasReview && !isRunning && <p className={styles.empty}>Run a check to identify missing requirements.</p>}
      {hasReview && sorted.length === 0 && <p className={styles.empty}>No open gaps. Nothing here is currently flagged.</p>}
      <ul className={styles.findings}>
        {sorted.map((finding) => {
          const isActive = finding.id === activeFindingId;
          return (
            <li key={finding.id} className={styles.finding} data-expanded={isActive}>
              <button type="button" onClick={() => onSelectFinding(isActive ? null : finding.id)}
                disabled={isRunning} aria-expanded={isActive} aria-controls={`${findingIdPrefix}-${finding.id}`}
                className={styles.findingTrigger}>
                <span className={styles.findingCopy}>
                  <span className={styles.findingMeta}>
                    <span aria-hidden="true" className={`${styles.findingDot} ${SEVERITY_DOT[finding.severity]}`} />
                    {finding.severity} · {CATEGORY_LABEL[finding.category]}
                  </span>
                  <span className={styles.findingTitle}>{finding.title}</span>
                </span>
                <CaretDownIcon size={14} aria-hidden="true" className={styles.chevron} data-open={isActive} />
              </button>
              <OverviewDisclosure isOpen={isActive} id={`${findingIdPrefix}-${finding.id}`}>
                <div className={styles.findingDetails}>
                  <p className={styles.detailText}>{finding.description}</p>
                  <div className={styles.suggestion}>
                    <h3 className={styles.eyebrow}>Suggested feature</h3>
                    <span className={styles.componentName}>{finding.suggestedFeature.name}</span>
                    <p className={styles.detailText}>{finding.suggestedFeature.description}</p>
                  </div>
                  {finding.relatedFeatureIds.length > 0 && <ul aria-label="Related capabilities" className={styles.dependencyList}>
                    {finding.relatedFeatureIds.map((id) => <li key={id}>{featureNames.has(id)
                      ? <button type="button" onClick={() => onRevealFeature(id)}><ArrowRightIcon size={12} aria-hidden="true" />{featureNames.get(id)}</button>
                      : <span>{id}</span>}</li>)}
                  </ul>}
                  <button type="button" disabled={disabled} onClick={(event) => handleDismiss(event.currentTarget, finding.id, true)} className={styles.dismiss}>Dismiss</button>
                </div>
              </OverviewDisclosure>
            </li>
          );
        })}
      </ul>
      {dismissed.length > 0 && <div className={styles.dismissed}>
        <h3 className={styles.eyebrow}>Dismissed ({dismissed.length})</h3>
        <ul>{dismissed.map((finding) => <li key={finding.id}>
          <span>{finding.title}</span>
          <button type="button" disabled={disabled} onClick={(event) => handleDismiss(event.currentTarget, finding.id, false)}>Restore</button>
        </li>)}</ul>
      </div>}
    </section>
  );
}
