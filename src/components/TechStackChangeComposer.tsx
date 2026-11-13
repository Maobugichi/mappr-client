'use client';

import type { MapprSystem } from '@/lib/api';
import type { TechStackChangeController } from '@/lib/tech-stack-change';
import type { TechStackProposal } from '@/lib/tech-stack-change-contract';
import type { OverviewChangeState } from '@/lib/overview-change';
import { OverviewChangeComposer } from './OverviewChangeComposer';
import styles from './OverviewChangeComposer.module.css';

function TechnologyFields({ technology }: { technology: MapprSystem['techStack'][number] }) {
  return <dl className={styles.nodeFields}>
    <div><dt>Category</dt><dd><code>{technology.category}</code></dd></div>
    <div><dt>Technology</dt><dd>{technology.choice}</dd></div>
    <div><dt>Rationale</dt><dd>{technology.rationale}</dd></div>
  </dl>;
}

export function TechStackChangeDiff({ proposal }: { proposal: TechStackProposal }) {
  const { added, removed, changed } = proposal.diff.techStack;
  return <div aria-label="Server-returned Tech Stack diff" className={styles.architectureDiff}>
    {added.length > 0 && <section aria-label="Added technologies"><h4>Added technologies ({added.length})</h4>
      {added.map((item) => <div className={styles.changeRow} key={item.category}><TechnologyFields technology={item} /></div>)}</section>}
    {changed.length > 0 && <section aria-label="Updated technologies"><h4>Updated technologies ({changed.length})</h4>
      {changed.map((change) => <div className={styles.changeRow} key={change.before.category}>
        <p className={styles.meta}>Category <code>{change.before.category}</code> · Changed: {change.changedFields.join(', ')}</p>
        <div className={styles.diff}>
          <div><h4>Before</h4><TechnologyFields technology={change.before} /></div>
          <div className={styles.after}><h4>Proposed</h4><TechnologyFields technology={change.after} /></div>
        </div>
      </div>)}</section>}
    {removed.length > 0 && <section aria-label="Removed technologies"><h4>Removed technologies ({removed.length})</h4>
      {removed.map((item) => <div className={styles.changeRow} key={item.category}><TechnologyFields technology={item} /></div>)}</section>}
  </div>;
}

export function TechStackChangeComposer({ controller, state }: {
  controller: TechStackChangeController; state: OverviewChangeState<TechStackProposal>;
}) {
  return <OverviewChangeComposer controller={controller} state={state} scope="tech-stack"
    reviewDiff={state.proposal && <TechStackChangeDiff proposal={state.proposal} />} />;
}
