'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightIcon, ArrowUpIcon, CaretDownIcon, LinkIcon, MagnifyingGlassIcon, WrenchIcon } from '@phosphor-icons/react';
import type { FindingSeverity, MapprSystem, RequirementsReview, TraceabilityReview } from '@/lib/api';
import {
  ApiError, getRequirementsReview, getTraceability, runIteration,
  runRequirementsReview, runTraceability, setRequirementDismissed,
} from '@/lib/api';
import { ActionButton } from './ActionButton';
import { MissingRequirements } from './MissingRequirements';
import { OverviewDisclosure } from './OverviewDisclosure';
import styles from './Overview.module.css';

const SEVERITY_COLOR: Record<FindingSeverity, string> = {
  low: 'var(--color-trace)',
  medium: 'var(--color-severity-medium)',
  high: 'var(--color-danger)',
  critical: 'var(--color-danger)',
};

function defaultFixInstruction(feature: MapprSystem['features'][number]): string {
  return `Add an architecture component for the feature "${feature.name}": ${feature.description}`;
}

function dependencyRoute(x: number, y: number, tx: number, ty: number): string {
  const lane = Math.max(6, Math.min(x, tx) - 20);
  const direction = ty >= y ? 1 : -1;
  // Keep both elbows inside the existing gutter. Short routes use a smaller
  // radius so their bends meet cleanly without overshooting either endpoint.
  const radius = Math.max(0, Math.min(6, Math.abs(ty - y) / 2, (x - lane) / 2, (tx - lane) / 2));
  return `M ${x} ${y} H ${lane + radius} Q ${lane} ${y} ${lane} ${y + direction * radius}`
    + ` V ${ty - direction * radius} Q ${lane} ${ty} ${lane + radius} ${ty} H ${tx}`;
}

export function Overview({ mapId, product, features, architecture, onSystemUpdated }: {
  mapId: string;
  product: MapprSystem['product'];
  features: MapprSystem['features'];
  architecture: MapprSystem['architecture'];
  onSystemUpdated: (system: MapprSystem) => void;
}) {
  const nameById = new Map(features.map((feature) => [feature.id, feature.name]));
  const nodeById = new Map(architecture.nodes.map((node) => [node.id, node]));
  const contentId = useId();
  const [capabilitiesExpanded, setCapabilitiesExpanded] = useState(false);
  const featureTriggers = useRef(new Map<string, HTMLButtonElement>());
  const featureCards = useRef(new Map<string, HTMLLIElement>());
  const featureMapRef = useRef<HTMLDivElement>(null);
  const dependencyLinesRef = useRef<SVGSVGElement>(null);
  const [activeDependency, setActiveDependency] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [expandedFeatureIds, setExpandedFeatureIds] = useState<Set<string>>(() => new Set());
  const [review, setReview] = useState<RequirementsReview | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(true);
  const [traceability, setTraceability] = useState<TraceabilityReview | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [isLoadingTrace, setIsLoadingTrace] = useState(true);
  const [pendingDismissalId, setPendingDismissalId] = useState<string | null>(null);
  // Synchronous guard covers double clicks and incompatible writes before
  // React commits disabled states. Saved review/trace reads stay independent.
  const operationRef = useRef<'review' | 'trace' | 'fix' | 'dismiss' | null>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  const traceTriggerRef = useRef<HTMLButtonElement>(null);
  const lastActionTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [fixDraftFeatureId, setFixDraftFeatureId] = useState<string | null>(null);
  const [fixInstruction, setFixInstruction] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);
  const fixTriggerRef = useRef<HTMLButtonElement | null>(null);
  const fixInputId = useId();
  const isBusy = isRunning || isTracing || isFixing || pendingDismissalId !== null;
  const actionsDisabled = isBusy || isLoadingReview || isLoadingTrace;
  const isFixFeatureExpanded = fixDraftFeatureId !== null && expandedFeatureIds.has(fixDraftFeatureId);

  useEffect(() => {
    if (isBusy || document.activeElement !== document.body) return;
    lastActionTriggerRef.current?.focus({ preventScroll: true });
    lastActionTriggerRef.current = null;
  }, [isBusy]);

  useEffect(() => {
    if (fixDraftFeatureId && isFixFeatureExpanded) {
      document.getElementById(`${fixInputId}-${fixDraftFeatureId}`)?.focus({ preventScroll: true });
    } else if (!fixDraftFeatureId && !isFixing && fixTriggerRef.current?.isConnected && !fixTriggerRef.current.closest('[inert]')) {
      fixTriggerRef.current.focus({ preventScroll: true });
    }
  }, [fixDraftFeatureId, isFixFeatureExpanded, fixInputId, isFixing]);

  useEffect(() => {
    let cancelled = false;
    getRequirementsReview(mapId)
      .then((existing) => { if (!cancelled) setReview(existing); })
      .catch(() => { if (!cancelled) setError('Could not load the saved requirements check. You can run a new check.'); })
      .finally(() => { if (!cancelled) setIsLoadingReview(false); });
    getTraceability(mapId)
      .then((existing) => { if (!cancelled) setTraceability(existing); })
      .catch(() => { if (!cancelled) setTraceError('Could not load saved traceability. You can trace requirements again.'); })
      .finally(() => { if (!cancelled) setIsLoadingTrace(false); });
    return () => { cancelled = true; };
  }, [mapId]);

  const handleRun = useCallback(async () => {
    if (operationRef.current || isLoadingReview || isLoadingTrace) return;
    operationRef.current = 'review';
    lastActionTriggerRef.current = reviewTriggerRef.current;
    setIsRunning(true);
    setError(null);
    setActiveFindingId(null);
    try {
      setReview(await runRequirementsReview(mapId));
    } catch (err) {
      setError(err instanceof ApiError ? (err.body.message ?? err.body.error) : 'Something went wrong running the requirements check.');
    } finally {
      operationRef.current = null;
      setIsRunning(false);
    }
  }, [mapId, isLoadingReview, isLoadingTrace, setActiveFindingId]);

  const handleTrace = useCallback(async () => {
    if (operationRef.current || isLoadingReview || isLoadingTrace) return;
    operationRef.current = 'trace';
    lastActionTriggerRef.current = traceTriggerRef.current;
    setIsTracing(true);
    setTraceError(null);
    try {
      setTraceability(await runTraceability(mapId));
    } catch (err) {
      setTraceError(err instanceof ApiError ? (err.body.message ?? err.body.error) : 'Something went wrong tracing requirements.');
    } finally {
      operationRef.current = null;
      setIsTracing(false);
    }
  }, [mapId, isLoadingReview, isLoadingTrace]);

  const handleDismiss = useCallback(async (findingId: string, dismissed: boolean) => {
    if (operationRef.current || isLoadingReview || isLoadingTrace || !review) return;
    operationRef.current = 'dismiss';
    const previous = review;
    setPendingDismissalId(findingId);
    setError(null);
    setReview({ ...review, findings: review.findings.map((finding) => finding.id === findingId ? { ...finding, dismissed } : finding) });
    if (activeFindingId === findingId && dismissed) setActiveFindingId(null);
    try {
      setReview(await setRequirementDismissed(mapId, findingId, dismissed));
    } catch {
      setReview(previous);
      setError('Could not save the finding change. Your previous findings have been restored. Please try again.');
    } finally {
      operationRef.current = null;
      setPendingDismissalId(null);
    }
  }, [mapId, review, activeFindingId, isLoadingReview, isLoadingTrace, setActiveFindingId]);

  const handleOpenFix = useCallback((feature: MapprSystem['features'][number], trigger: HTMLButtonElement) => {
    if (operationRef.current) return;
    fixTriggerRef.current = trigger;
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
    if (!trimmed || operationRef.current || isLoadingReview || isLoadingTrace) return;
    operationRef.current = 'fix';
    setIsFixing(true);
    setFixError(null);
    try {
      const result = await runIteration(mapId, trimmed);
      onSystemUpdated(result.data);
      setFixSuccessMessage(`v${result.version}: ${result.summary} — re-trace to confirm this feature is now linked.`);
      setFixDraftFeatureId(null);
    } catch (err) {
      setFixError(err instanceof ApiError ? (err.body.message ?? err.body.error) : 'Failed to apply the fix.');
    } finally {
      operationRef.current = null;
      setIsFixing(false);
    }
  }, [mapId, fixInstruction, onSystemUpdated, isLoadingReview, isLoadingTrace]);

  const revealFeature = (id: string) => {
    setExpandedFeatureIds((ids) => new Set(ids).add(id));
    featureTriggers.current.get(id)?.focus({ preventScroll: true });
    featureTriggers.current.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const activeFinding = useMemo(() => review?.findings.find((finding) => finding.id === activeFindingId) ?? null, [review, activeFindingId]);
  const highlightedFeatureIds = useMemo(() => new Set(activeFinding?.relatedFeatureIds ?? []), [activeFinding]);
  const linksByFeatureId = useMemo(() => new Map((traceability?.links ?? []).map((link) => [link.featureId, link])), [traceability]);
  const activeFindingsCount = review?.findings.filter((finding) => !finding.dismissed).length ?? 0;
  const tracedCount = features.filter((feature) => (linksByFeatureId.get(feature.id)?.nodeIds.length ?? 0) > 0).length;
  const orphanNodes = useMemo(() => {
    if (!traceability) return [];
    const tracedIds = new Set(traceability.links.flatMap((link) => link.nodeIds));
    return architecture.nodes.filter((node) => !tracedIds.has(node.id));
  }, [traceability, architecture.nodes]);
  const reviewPending = isRunning || isLoadingReview;
  const tracePending = isTracing || isLoadingTrace;
  const dependencySource = features.find((feature) => feature.id === activeDependency?.sourceId);
  const dependencyTarget = features.find((feature) => feature.id === activeDependency?.targetId);
  const dependenciesVisible = Boolean(dependencySource && dependencyTarget
    && dependencySource.dependsOn.includes(dependencyTarget.id)
    && expandedFeatureIds.has(dependencySource.id) && expandedFeatureIds.has(dependencyTarget.id));
  const toggleFeature = (id: string) => {
    if (expandedFeatureIds.has(id) && (activeDependency?.sourceId === id || activeDependency?.targetId === id)) {
      setActiveDependency(null);
    }
    setExpandedFeatureIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const activateDependency = (sourceId: string, targetId: string) => {
    if (!nameById.has(targetId)) return;
    setExpandedFeatureIds((ids) => new Set(ids).add(sourceId).add(targetId));
    setActiveDependency({ sourceId, targetId });
  };

  useEffect(() => {
    if (!activeDependency || !dependenciesVisible) return;
    let cancelled = false;
    // Reveal only offscreen targets, after the disclosure layout has settled.
    // Reduced motion has no spatial animations, so the wait resolves immediately.
    const frame = requestAnimationFrame(() => {
      const animations = (featureMapRef.current?.getAnimations({ subtree: true }) ?? [])
        .filter((animation) => animation instanceof CSSTransition && animation.transitionProperty === 'grid-template-rows');
      void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        if (cancelled) return;
        const trigger = featureTriggers.current.get(activeDependency.targetId);
        const rect = trigger?.getBoundingClientRect();
        if (rect && (rect.top < 24 || rect.bottom > window.innerHeight - 16)) {
          trigger?.scrollIntoView({ block: 'nearest', inline: 'nearest',
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        }
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [activeDependency, dependenciesVisible]);

  useLayoutEffect(() => {
    const container = featureMapRef.current;
    const svg = dependencyLinesRef.current;
    if (!container || !svg || !activeDependency || !dependenciesVisible) return;
    const measure = () => {
      const origin = container.getBoundingClientRect();
      const source = featureCards.current.get(activeDependency.sourceId);
      const sourceHeader = featureTriggers.current.get(activeDependency.sourceId);
      const sourceRect = source?.getBoundingClientRect();
      const headerRect = sourceHeader?.getBoundingClientRect();
      if (!sourceRect?.width || !headerRect?.height) {
        svg.dataset.ready = 'false';
        return;
      }
      const x = sourceRect.left - origin.left;
      const y = headerRect.top + headerRect.height / 2 - origin.top;
      // Routes stay in the reserved gutter and terminate on measured borders.
      let visible = 0;
      for (const group of svg.querySelectorAll<SVGGElement>('[data-dependency-target]')) {
        const id = group.dataset.dependencyTarget!;
        const targetRect = featureCards.current.get(id)?.getBoundingClientRect();
        const targetHeader = featureTriggers.current.get(id)?.getBoundingClientRect();
        const available = Boolean(targetRect?.width && targetHeader?.height);
        group.style.display = available ? '' : 'none';
        if (!available || !targetRect || !targetHeader) continue;
        const tx = targetRect.left - origin.left;
        const ty = id === activeDependency.sourceId ? y + 12
          : targetHeader.top + targetHeader.height / 2 - origin.top;
        const [route, arrow] = group.querySelectorAll('path');
        const [start, end] = group.querySelectorAll('circle');
        route.setAttribute('d', dependencyRoute(x, y, tx, ty));
        arrow.setAttribute('d', `M ${tx - 10} ${ty - 3} l 3 3 l -3 3`);
        start.setAttribute('cx', String(x));
        start.setAttribute('cy', String(y));
        end.setAttribute('cx', String(tx));
        end.setAttribute('cy', String(ty));
        visible++;
      }
      svg.dataset.ready = String(visible > 0);
    };
    measure();
    // Observe all cards: an unrelated expansion can move either endpoint.
    // ResizeObserver batches layout changes before paint; SVG attributes
    // update directly without rerendering Overview or changing card sizes.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const card of featureCards.current.values()) observer.observe(card);
    for (const header of featureTriggers.current.values()) observer.observe(header);
    return () => observer.disconnect();
  }, [activeDependency, features, dependenciesVisible]);

  return (
    <div className={styles.overview}>
      <section aria-label="Product blueprint" className={styles.product}>
        <p className={styles.eyebrow}>Product blueprint</p>
        <p className={styles.summary}>{product.summary}</p>
        {product.concepts.length > 0 && <>
          <button type="button" className={styles.capabilitiesToggle}
            aria-expanded={capabilitiesExpanded} aria-controls={`${contentId}-product-capabilities`}
            onClick={() => setCapabilitiesExpanded((expanded) => !expanded)}>
            {capabilitiesExpanded ? 'Hide capabilities'
              : `View ${product.concepts.length} ${product.concepts.length === 1 ? 'capability' : 'capabilities'}`}
            <CaretDownIcon size={14} aria-hidden="true" className={styles.capabilitiesChevron} />
          </button>
          <div id={`${contentId}-product-capabilities`} role="region" aria-label="Product capabilities"
            className={styles.capabilitiesRegion} data-expanded={capabilitiesExpanded}>
            <div className={styles.capabilitiesContent}>
              <ul aria-label="Product concepts" className={`${styles.tags} ${styles.productCapabilities}`}>
                {product.concepts.map((concept) => <li key={concept}>{concept}</li>)}
              </ul>
            </div>
          </div>
        </>}
      </section>

      <dl aria-label="System snapshot" className={styles.snapshot}>
        <div><dt>Features</dt><dd>{features.length}</dd></div>
        <div><dt>Traced features</dt><dd>{traceability ? tracedCount : '—'}</dd></div>
        <div><dt>Untraced features</dt><dd>{traceability ? features.length - tracedCount : '—'}</dd></div>
        <div><dt>Open requirements gaps</dt><dd>{review ? activeFindingsCount : '—'}</dd></div>
      </dl>

      <p role="status" aria-atomic="true" className="sr-only">
        {isRunning ? 'Checking requirements.' : isTracing ? 'Tracing feature relationships.'
          : reviewPending || tracePending ? 'Loading saved checks.'
            : `Checks ready. ${traceability ? `${tracedCount} of ${features.length} features traced.` : 'Traceability has not been run.'} ${review ? `${activeFindingsCount} open requirements gaps.` : 'Requirements have not been checked.'}`}
      </p>

      <div className={styles.workspace}>
        <section aria-labelledby={`${contentId}-features`} className={styles.capabilities}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>How it connects</p>
              <h2 id={`${contentId}-features`} className={styles.sectionTitle}>Capabilities</h2>
            </div>
            <ActionButton ref={traceTriggerRef} compactPending variant="secondary"
              state={tracePending ? 'pending' : traceError ? 'error' : 'idle'}
              idleLabel={traceability ? 'Re-trace Requirements' : 'Trace Requirements'}
              pendingLabel={isLoadingTrace ? 'Loading saved traceability' : 'Tracing requirements'}
              icon={<LinkIcon size={14} weight="bold" />} onClick={handleTrace} disabled={actionsDisabled} />
          </div>
          <p className={styles.sectionHint}>Explore each feature&rsquo;s dependencies and implementing components.</p>
          {traceError && <p role="alert" className={styles.error}>{traceError}</p>}
          {fixSuccessMessage && <p role="status" className={styles.notice}>{fixSuccessMessage}</p>}
          {features.length === 0 && <p className={styles.empty}>No features have been defined for this map yet.</p>}
          <div ref={featureMapRef} className={styles.featureMap}>
          <svg ref={dependencyLinesRef} className={styles.dependencyLines} aria-hidden="true" focusable="false"
            data-visible={dependenciesVisible}>
            {dependenciesVisible && activeDependency && <g key={activeDependency.sourceId + '-' + activeDependency.targetId} className={styles.dependencyGroup}>
              <g data-dependency-target={activeDependency.targetId}>
                <path /><path /><circle r="2.5" /><circle r="2.5" />
              </g>
            </g>}
          </svg>
          <ul className={styles.featureList}>
            {features.map((feature) => {
              const isExpanded = expandedFeatureIds.has(feature.id);
              const link = linksByFeatureId.get(feature.id);
              const nodeIds = link?.nodeIds ?? [];
              const isGap = Boolean(traceability && nodeIds.length === 0);
              const severity = highlightedFeatureIds.has(feature.id) ? activeFinding?.severity : undefined;
              const isFixOpen = fixDraftFeatureId === feature.id;
              return (
                <li key={feature.id}
                  ref={(element) => { if (element) featureCards.current.set(feature.id, element); else featureCards.current.delete(feature.id); }}
                  className={styles.feature} data-expanded={isExpanded} data-highlighted={Boolean(severity)}
                  data-dependency-role={dependenciesVisible
                    ? feature.id === activeDependency?.sourceId ? 'source' : feature.id === activeDependency?.targetId ? 'target' : undefined
                    : undefined}>
                  <button ref={(element) => { if (element) featureTriggers.current.set(feature.id, element); else featureTriggers.current.delete(feature.id); }}
                    type="button" id={`${contentId}-feature-${feature.id}`} aria-expanded={isExpanded}
                    aria-controls={`${contentId}-details-${feature.id}`} className={styles.featureTrigger}
                    onClick={() => toggleFeature(feature.id)}>
                    <span className={styles.featureCopy}>
                      <span className={styles.featureHeading}>
                        <span className={styles.featureTitle}>{feature.name}</span>
                        <span className={styles.traceState} data-traced={Boolean(traceability && !isGap)}>
                          {traceability ? isGap ? 'Untraced' : 'Traced' : 'Not traced yet'}
                        </span>
                      </span>
                      <span className={styles.featureDescription} data-expanded={isExpanded}>{feature.description}</span>
                      {severity && <span className={styles.findingMarker}>
                        <span aria-hidden="true" style={{ backgroundColor: SEVERITY_COLOR[severity] }} />
                        {severity} finding
                      </span>}
                    </span>
                    <CaretDownIcon size={16} aria-hidden="true" className={styles.chevron} data-open={isExpanded} />
                  </button>
                  <OverviewDisclosure isOpen={isExpanded} id={`${contentId}-details-${feature.id}`}>
                    <div className={styles.featureDetails}>
                      <div className={styles.connections}>
                        <div>
                          <h3 className={styles.eyebrow}>
                            <span className={styles.dependencyLabel}>
                              <LinkIcon size={12} aria-hidden="true" />Depends on
                              {feature.dependsOn.length > 0 && <span>({feature.dependsOn.length})</span>}
                            </span>
                          </h3>
                          {feature.dependsOn.length ? <ul className={styles.dependencyList}>
                            {feature.dependsOn.map((id) => <li key={id}>
                              {nameById.has(id) ? <button type="button" onClick={() => activateDependency(feature.id, id)}
                                aria-controls={contentId + "-details-" + id}
                                aria-pressed={dependenciesVisible && activeDependency?.sourceId === feature.id && activeDependency?.targetId === id}>
                                <ArrowRightIcon size={12} aria-hidden="true" />{nameById.get(id)}
                              </button> : <span>{id}</span>}
                            </li>)}
                          </ul> : <p className={styles.detailText}>No feature dependencies specified.</p>}
                        </div>
                        <div>
                          <h3 className={styles.eyebrow}>Implemented by</h3>
                          {!traceability ? <p className={styles.detailText}>Trace requirements to discover component links.</p>
                            : nodeIds.length ? <ul className={styles.componentList}>
                              {nodeIds.map((id) => {
                                const node = nodeById.get(id);
                                return <li key={id}><span className={styles.componentName}>{node?.label ?? id}</span>
                                  {node && <><span className={styles.componentType}>{node.type}</span><p className={styles.detailText}>{node.description}</p></>}
                                </li>;
                              })}
                            </ul> : <>
                              <p className={styles.detailText}>No architecture component is linked to this feature.</p>
                              <button type="button" disabled={actionsDisabled} aria-expanded={isFixOpen}
                                aria-controls={`${contentId}-fix-${feature.id}`} className={styles.fixTrigger}
                                aria-label={`Fix untraced feature: ${feature.name}`}
                                onClick={(event) => handleOpenFix(feature, event.currentTarget)}>
                                <WrenchIcon size={12} aria-hidden="true" />Draft a component fix
                              </button>
                            </>}
                        </div>
                      </div>
                      {link?.note && <p className={styles.traceNote}><span>Trace note</span>{link.note}</p>}
                      <OverviewDisclosure isOpen={Boolean(isGap && isFixOpen)} id={`${contentId}-fix-${feature.id}`}>
                        <form className={styles.fixForm} aria-label={`Fix ${feature.name}`} aria-busy={isFixing}
                          onSubmit={(event) => { event.preventDefault(); void handleApplyFix(); }}
                          onKeyDown={(event) => { if (event.key === 'Escape' && !isFixing) { event.preventDefault(); event.stopPropagation(); handleCancelFix(); } }}>
                          <label htmlFor={`${fixInputId}-${feature.id}`} className={styles.eyebrow}>Describe the component to add</label>
                          <textarea id={`${fixInputId}-${feature.id}`} rows={2} value={fixInstruction}
                            aria-describedby={fixError ? `${fixInputId}-${feature.id}-error` : undefined}
                            aria-invalid={Boolean(fixError)} onChange={(event) => setFixInstruction(event.target.value)} disabled={actionsDisabled} />
                          <div className={styles.fixActions}>
                            <button type="button" onClick={handleCancelFix} disabled={isFixing} className={styles.textAction}>Cancel</button>
                            <ActionButton compactPending state={isFixing ? 'pending' : 'idle'} idleLabel="Apply fix" pendingLabel="Applying component fix"
                              type="submit" icon={<ArrowUpIcon size={14} weight="bold" />} disabled={actionsDisabled || !fixInstruction.trim()} />
                          </div>
                          {fixError && <p id={`${fixInputId}-${feature.id}-error`} role="alert" className={styles.error}>{fixError}</p>}
                        </form>
                      </OverviewDisclosure>
                    </div>
                  </OverviewDisclosure>
                </li>
              );
            })}
          </ul>
          </div>
          <p role="status" aria-atomic="true" className="sr-only">
            {dependenciesVisible && dependencySource && dependencyTarget
              ? dependencySource.name + ' depends on ' + dependencyTarget.name + '. Both features expanded. Connection points toward the dependency.'
              : 'No active dependency connection.'}
          </p>
          {traceability && orphanNodes.length > 0 && <section aria-label="Unlinked architecture components" className={styles.orphans}>
            <h3 className={styles.eyebrow}>Components without feature links</h3>
            <ul className={styles.tags}>{orphanNodes.map((node) => <li key={node.id}>{node.label}</li>)}</ul>
          </section>}
        </section>

        <MissingRequirements findings={review?.findings ?? []} activeFindingId={activeFindingId}
          onSelectFinding={setActiveFindingId} onDismissFinding={handleDismiss}
          isRunning={reviewPending} disabled={actionsDisabled} hasReview={Boolean(review)} error={error}
          featureNames={nameById} onRevealFeature={revealFeature}
          action={<ActionButton ref={reviewTriggerRef} compactPending
            state={reviewPending ? 'pending' : error ? 'error' : 'idle'}
            idleLabel={review ? 'Re-run Check' : 'Run Check'}
            pendingLabel={isLoadingReview ? 'Loading saved requirements check' : 'Checking requirements'}
            icon={<MagnifyingGlassIcon size={14} weight="bold" />} onClick={handleRun} disabled={actionsDisabled} />} />
      </div>
    </div>
  );
}
