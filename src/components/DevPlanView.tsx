'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';
import type { MapprSystem } from '@/lib/api';
import { MotionDisclosure } from './MotionDisclosure';
import styles from './DevPlanView.module.css';

export function DevPlanView({ developmentPlan, features }: {
  developmentPlan: MapprSystem['developmentPlan'];
  features: MapprSystem['features'];
}) {
  const roadmapId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const navigatorRef = useRef<HTMLElement>(null);
  const taskWorkspaceRef = useRef<HTMLDivElement>(null);
  const phaseHeadingRef = useRef<HTMLHeadingElement>(null);
  const revealFrameRef = useRef<number | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => new Set());
  const phases = useMemo(() => developmentPlan
    .map((phase, index) => ({ ...phase, key: phase.phase + '-' + index }))
    // Preserve the chronological ordering used by the existing view without
    // sorting or mutating the backend array itself.
    .sort((a, b) => a.phase - b.phase), [developmentPlan]);
  const selected = phases.find((phase) => phase.key === selectedKey) ?? phases[0];
  const nameById = useMemo(() => new Map(features.map((feature) => [feature.id, feature.name])), [features]);
  const hasPhases = phases.length > 0;

  useLayoutEffect(() => {
    const navigator = navigatorRef.current;
    if (!navigator) return;
    const measure = () => {
      const top = parseFloat(getComputedStyle(navigator).getPropertyValue('--roadmap-sticky-top')) || 24;
      // Long navigators stay in document flow so every phase remains reachable.
      navigator.dataset.fitsViewport = String(navigator.getBoundingClientRect().height <= window.innerHeight - top - 16);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(navigator);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [hasPhases]);

  useEffect(() => () => {
    if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
  }, []);

  const selectPhase = (key: string, reveal = true) => {
    setSelectedKey(key);
    if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
    if (!reveal || !rootRef.current || rootRef.current.clientWidth >= 900) return;
    revealFrameRef.current = requestAnimationFrame(() => {
      const heading = phaseHeadingRef.current, rect = heading?.getBoundingClientRect();
      if (!heading || !rect || (rect.top >= 24 && rect.bottom <= window.innerHeight - 16)) return;
      heading.focus({ preventScroll: true });
      taskWorkspaceRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    });
  };
  const navigatePhases = (event: KeyboardEvent<HTMLOListElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const current = tabs.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : Math.max(0, Math.min(tabs.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
    selectPhase(phases[next].key, false);
    tabs[next].focus({ preventScroll: true });
    tabs[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const toggleFeatures = (key: string) => {
    setExpandedTasks((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section ref={rootRef} className={styles.roadmap} aria-labelledby={roadmapId + '-heading'}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Development plan</p>
        <h2 id={roadmapId + '-heading'} className={styles.title}>Execution roadmap</h2>
        <p className={styles.hint}>Inspect the tasks and feature relationships in each development phase.</p>
      </header>

      {!selected ? <p className={styles.empty}>No development phases have been defined for this map.</p> : (
        <div className={styles.workspace}>
          <nav ref={navigatorRef} className={styles.navigator} aria-label="Roadmap phase navigation">
            <h3 className={styles.navigatorHeading}>Development phases</h3>
            <p className={styles.selectionHint}>Amber marks the phase selected for inspection.</p>
            <ol role="tablist" aria-label="Development phases" aria-orientation="vertical"
              className={styles.phaseList} onKeyDown={navigatePhases}>
              {phases.map((phase) => {
                const isSelected = selected.key === phase.key;
                return (
                  <li key={phase.key} role="presentation">
                    <button type="button" role="tab" id={roadmapId + '-phase-' + phase.key}
                      data-phase={phase.phase} aria-selected={isSelected}
                      aria-controls={roadmapId + '-tasks-' + phase.key} tabIndex={isSelected ? 0 : -1}
                      className={styles.phaseButton} onClick={() => selectPhase(phase.key)}>
                      <span className={styles.phaseNumber}><span className="sr-only">Phase </span>{phase.phase}</span>
                      <span className={styles.phaseCopy}>
                        <span className={styles.phaseName}>{phase.title}</span>
                        <span className={styles.phaseTaskCount}>{phase.items.length} {phase.items.length === 1 ? 'task' : 'tasks'}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div ref={taskWorkspaceRef} className={styles.taskWorkspace}>
            {phases.map((phase) => (
              <div key={phase.key} id={roadmapId + '-tasks-' + phase.key} role="tabpanel"
                aria-labelledby={roadmapId + '-phase-' + phase.key} hidden={selected.key !== phase.key}
                tabIndex={0} className={styles.taskPanel}>
                {selected.key === phase.key && (
                  <div className={styles.phaseContent}>
                    <header className={styles.phaseHeader}>
                      <p className={styles.eyebrow}>Phase {phase.phase}</p>
                      <h3 ref={phaseHeadingRef} tabIndex={-1} className={styles.selectedTitle}>{phase.title}</h3>
                    </header>
                    {phase.items.length === 0 ? <p className={styles.empty}>No tasks were provided for this phase.</p> : (
                      <ol className={styles.tasks} aria-label={'Tasks for phase ' + phase.phase}>
                        {phase.items.map((item, index) => {
                          // Preserve support for older generations that stored
                          // tasks as plain strings or omitted relatedFeatures.
                          const raw = item as unknown as string | typeof item;
                          const description = typeof raw === 'string' ? raw : raw.description;
                          const relatedFeatures = typeof raw === 'string' ? [] : (raw.relatedFeatures ?? []);
                          const taskKey = phase.key + '-' + index;
                          const isExpanded = expandedTasks.has(taskKey);
                          return (
                            <li key={index} className={styles.task}>
                              <span className={styles.taskNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                              <div className={styles.taskBody}>
                                <p className={styles.taskDescription}>{description}</p>
                                {relatedFeatures.length > 0 && <div className={styles.relationships}>
                                  <p className={styles.eyebrow}>Related features</p>
                                  {/* Dev Plan has no cross-view feature-navigation
                                      callback. Preserve references as readable labels. */}
                                  <ul className={styles.features} aria-label="Related features">
                                    {relatedFeatures.slice(0, 3).map((id, featureIndex) => (
                                      <li key={id + '-' + featureIndex}>{nameById.get(id) ?? id}</li>
                                    ))}
                                  </ul>
                                  {relatedFeatures.length > 3 && <>
                                    <MotionDisclosure isOpen={isExpanded} id={roadmapId + '-features-' + taskKey}>
                                      <ul className={styles.extraFeatures} aria-label="Additional related features">
                                        {relatedFeatures.slice(3).map((id, featureIndex) => (
                                          <li key={id + '-' + featureIndex}>{nameById.get(id) ?? id}</li>
                                        ))}
                                      </ul>
                                    </MotionDisclosure>
                                    <button type="button" className={styles.detailsToggle}
                                      aria-expanded={isExpanded} aria-controls={roadmapId + '-features-' + taskKey}
                                      onClick={() => toggleFeatures(taskKey)}>
                                      {isExpanded ? 'Show fewer features' : 'Show ' + (relatedFeatures.length - 3) + ' more features'}
                                      <CaretDownIcon size={12} aria-hidden="true" className={styles.chevron} data-open={isExpanded} />
                                    </button>
                                  </>}
                                </div>}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
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
