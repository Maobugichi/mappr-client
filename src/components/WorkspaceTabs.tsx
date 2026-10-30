'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import styles from './WorkspaceTabs.module.css';

export function WorkspaceTabs<T extends string>({ views, activeView, workspaceId, onActivate }: {
  views: readonly { id: T; label: string }[];
  activeView: T;
  workspaceId: string;
  onActivate: (id: T) => void;
}) {
  const [focusedView, setFocusedView] = useState(activeView);
  const focusTarget = views.some((view) => view.id === focusedView) ? focusedView : activeView;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const track = trackRef.current, scroller = scrollerRef.current, pill = pillRef.current;
    if (!track || !scroller || !pill) return;
    const tabs = Array.from(track.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const selected = tabs.find((tab) => tab.dataset.view === activeView);
    if (!selected) return;
    const measure = () => {
      track.style.setProperty('--pill-x', `${selected.offsetLeft}px`);
      track.style.setProperty('--pill-width', `${selected.offsetWidth}px`);
      track.style.setProperty('--pill-height', `${selected.offsetHeight}px`);
      pill.dataset.ready = 'true';
      const left = selected.offsetLeft, right = left + selected.offsetWidth;
      if (left < scroller.scrollLeft) scroller.scrollLeft = left;
      else if (right > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = right - scroller.clientWidth;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(track);
    tabs.forEach((tab) => observer.observe(tab));
    return () => observer.disconnect();
  }, [activeView, views]);

  return <div ref={scrollerRef} className={styles.scroller}>
    <div ref={trackRef} role="tablist" aria-label="Map views" aria-orientation="horizontal"
      className={`${styles.track} font-mono`}
      onKeyDown={(event) => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        const index = tabs.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].focus();
      }}>
      {views.map((view) => <button key={view.id} id={`${workspaceId}-tab-${view.id}`}
        type="button" role="tab" data-view={view.id} aria-selected={activeView === view.id}
        aria-controls={`${workspaceId}-panel-${view.id}`} tabIndex={focusTarget === view.id ? 0 : -1}
        onFocus={() => setFocusedView(view.id)} onClick={() => { setFocusedView(view.id); onActivate(view.id); }}
        className={styles.tab}>{view.label}</button>)}
      <span ref={pillRef} className={styles.pill} aria-hidden="true" data-workspace-pill>
        {/* Clipped duplicate text keeps dark lettering exactly over yellow
            throughout travel. The accessible labels are the real buttons. */}
        <span className={styles.pillLabels}>
          {views.map((view) => <span key={view.id}>{view.label}</span>)}
        </span>
      </span>
    </div>
  </div>;
}
