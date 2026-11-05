'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react';
import type { MapprSystem } from '@/lib/api';
import { ActionButton } from './ActionButton';
import styles from './DevPlanView.module.css';

export function DevPlanView({ developmentPlan, features }: {
  developmentPlan: MapprSystem['developmentPlan'];
  features: MapprSystem['features'];
}) {
  const roadmapId = useId();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const navigatorRef = useRef<HTMLElement>(null);
  const phaseHeaderRef = useRef<HTMLElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const phases = useMemo(() => developmentPlan
    .map((phase, index) => ({ ...phase, key: phase.phase + '-' + index }))
    // Keep the existing numbered chronology without mutating the source plan.
    .sort((a, b) => a.phase - b.phase), [developmentPlan]);
  const selected = phases.find((phase) => phase.key === selectedKey) ?? phases[0];
  const selectedIndex = selected ? phases.indexOf(selected) : -1;
  const selectionRequest = useRef({ key: selected?.key, reveal: false, focusHeading: false });
  const nameById = useMemo(() => new Map(features.map((feature) => [feature.id, feature.name])), [features]);

  const selectPhase = (key: string, focusHeading = false) => {
    // Track the latest intent synchronously, even before React commits a rapid
    // sequence of clicks. Re-selecting that phase does not restart scrolling.
    if (selectionRequest.current.key === key) return;
    selectionRequest.current = { key, reveal: true, focusHeading };
    setSelectedKey(key);
  };

  useLayoutEffect(() => {
    const scroller = scrollerRef.current, track = trackRef.current;
    if (!scroller || !track) return;
    const measure = () => {
      // Read the current DOM selection on every measurement, including rapid
      // switches and resizes. No delayed callback can restore an older phase.
      const button = track.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
      const nodes = track.querySelectorAll<HTMLElement>('[data-phase-node]');
      const node = button?.querySelector<HTMLElement>('[data-phase-node]');
      if (!button || !node || nodes.length === 0) return;
      const trackRect = track.getBoundingClientRect(), buttonRect = button.getBoundingClientRect();
      const first = nodes[0].getBoundingClientRect(), last = nodes[nodes.length - 1].getBoundingClientRect();
      const current = node.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
      const start = first.left + first.width / 2;
      const end = last.left + last.width / 2;
      const currentCenter = current.left + current.width / 2;
      track.style.setProperty('--phase-rail-x', `${start - trackRect.left}px`);
      track.style.setProperty('--phase-rail-y', `${first.top + first.height / 2 - trackRect.top}px`);
      track.style.setProperty('--phase-rail-width', `${Math.max(0, end - start)}px`);
      // This is the selected navigation range, never persisted work progress.
      track.style.setProperty('--phase-rail-fill', `${Math.max(0, Math.min(end, currentCenter) - start)}px`);
      track.style.setProperty('--phase-indicator-x', `${current.left - trackRect.left - 3}px`);
      track.style.setProperty('--phase-indicator-y', `${current.top - trackRect.top - 3}px`);
      track.style.setProperty('--phase-indicator-width', `${current.width + 6}px`);
      track.style.setProperty('--phase-indicator-height', `${current.height + 6}px`);
      track.dataset.ready = 'true';
      // Reveal only within the horizontal navigator; never scroll the page.
      const shift = buttonRect.left < viewport.left + 4 ? buttonRect.left - viewport.left - 4
        : buttonRect.right > viewport.right - 4 ? buttonRect.right - viewport.right + 4 : 0;
      if (shift) scroller.scrollLeft += shift;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(track);
    return () => observer.disconnect();
  }, [phases, selected?.key]);

  useLayoutEffect(() => {
    const request = selectionRequest.current;
    selectionRequest.current = { key: selected?.key, reveal: false, focusHeading: false };
    const navigator = navigatorRef.current, heading = phaseHeaderRef.current;
    if (!request.reveal || request.key !== selected?.key || !navigator || !heading) return;
    // The workspace navigation is in normal flow; the document is the page's
    // scroll container. Measure the responsive roadmap instead of assuming its
    // height, and leave a small reading gap below its sticky edge.
    const top = parseFloat(getComputedStyle(navigator).top) || 0;
    const offset = top + navigator.getBoundingClientRect().height + 16;
    const target = Math.max(0, window.scrollY + heading.getBoundingClientRect().top - offset);
    if (request.focusHeading) heading.querySelector<HTMLHeadingElement>('h3')?.focus({ preventScroll: true });
    window.scrollTo({ top: target, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [selected?.key]);

  const navigatePhases = (event: KeyboardEvent<HTMLOListElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey
      || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const current = tabs.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectPhase(phases[next].key);
    tabs[next].focus({ preventScroll: true });
  };

  return (
    <section className={styles.roadmap} aria-labelledby={roadmapId + '-heading'}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Development plan</p>
        <h2 id={roadmapId + '-heading'} className={styles.title}>Development roadmap</h2>
        <p className={styles.hint}>Select a phase to review its tasks and feature references.</p>
      </header>

      {!selected ? <p className={styles.empty}>No development phases have been defined for this map.</p> : (
        <div className={styles.workspace}>
          <nav ref={navigatorRef} className={styles.navigator} aria-label="Roadmap phase navigation">
            <div ref={scrollerRef} className={styles.phaseScroller}>
              <div ref={trackRef} className={styles.phaseTrack}>
                <ol role="tablist" aria-label="Development phases" aria-orientation="horizontal"
                  className={styles.phaseList} onKeyDown={navigatePhases}>
                  {phases.map((phase, index) => (
                    <li key={phase.key} role="presentation">
                      <button type="button" role="tab" id={roadmapId + '-phase-' + phase.key}
                        data-phase={phase.phase} aria-selected={selected.key === phase.key}
                        aria-label={'Phase ' + phase.phase + ': ' + phase.title}
                        data-in-path={index <= selectedIndex}
                        aria-controls={roadmapId + '-tasks-' + phase.key} tabIndex={selected.key === phase.key ? 0 : -1}
                        className={styles.phaseButton} onClick={() => selectPhase(phase.key)}>
                        <span className={styles.phaseNumber} data-phase-node><span className="sr-only">Phase </span>{phase.phase}</span>
                        <span className={styles.phaseName}>{phase.title}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <span className={styles.phaseRail} aria-hidden="true"><span className={styles.phaseRailFill} /></span>
                <span className={styles.phaseIndicator} aria-hidden="true" />
              </div>
            </div>
          </nav>

          <div className={styles.taskWorkspace}>
            {phases.map((phase) => (
              <div key={phase.key} id={roadmapId + '-tasks-' + phase.key} role="tabpanel"
                aria-labelledby={roadmapId + '-phase-' + phase.key} hidden={selected.key !== phase.key}
                tabIndex={0} className={styles.taskPanel}>
                {selected.key === phase.key && (
                  <div className={styles.phaseContent}>
                    <header ref={phaseHeaderRef} className={styles.phaseHeader}>
                      <div className={styles.phaseHeading}>
                        <p className={styles.eyebrow}>Phase {phase.phase}</p>
                        <h3 className={styles.selectedTitle} tabIndex={-1}>{phase.title}</h3>
                        <p className={styles.taskCount}>{phase.items.length} {phase.items.length === 1 ? 'task' : 'tasks'} in this phase</p>
                      </div>
                    </header>
                    {phase.items.length === 0 ? <p className={styles.empty}>No tasks were provided for this phase.</p> : (
                      <ol className={styles.tasks} aria-label={'Tasks for phase ' + phase.phase}>
                        {phase.items.map((item, index) => {
                          // Older saved plans may contain string tasks or omit
                          // relatedFeatures. Preserve their complete text too.
                          const raw = item as unknown as string | typeof item;
                          const description = typeof raw === 'string' ? raw : raw.description;
                          const relatedFeatures = typeof raw === 'string' ? [] : (raw.relatedFeatures ?? []);
                          return (
                            <li key={index} className={styles.task}>
                              <span className={styles.taskNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                              <div className={styles.taskBody}>
                                <p className={styles.taskDescription}>{description}</p>
                                {relatedFeatures.length > 0 && <div className={styles.relationships}>
                                  <p className={styles.relationshipLabel}>Related features</p>
                                  {/* No cross-view feature-navigation callback is
                                      available here; retain readable references. */}
                                  <ul className={styles.features} aria-label="Related features">
                                    {relatedFeatures.map((id, featureIndex) => (
                                      <li key={id + '-' + featureIndex}>{nameById.get(id) ?? id}</li>
                                    ))}
                                  </ul>
                                </div>}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    {phases.length > 1 && <div className={styles.phaseControls}>
                      {selectedIndex > 0 && <ActionButton compactPending variant="secondary"
                        className={`${styles.phaseAction} ${styles.previousPhase}`}
                        idleLabel="Previous phase" pendingLabel="Previous phase"
                        icon={<ArrowLeftIcon size={14} weight="bold" />}
                        onClick={() => selectPhase(phases[selectedIndex - 1].key, true)} />}
                      {selectedIndex < phases.length - 1 && <ActionButton compactPending variant="primary"
                        className={`${styles.phaseAction} ${styles.nextPhase}`} idleLabel="Next phase" pendingLabel="Next phase"
                        icon={<ArrowRightIcon size={14} weight="bold" />}
                        onClick={() => selectPhase(phases[selectedIndex + 1].key, true)} />}
                    </div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="sr-only" role="status" aria-atomic="true">
        {selected ? 'Inspecting phase ' + selected.phase + ': ' + selected.title + '. ' + selected.items.length + ' tasks.' : ''}
      </p>
    </section>
  );
}
