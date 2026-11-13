'use client';

import { useId } from 'react';
import type { MapprSystem } from '@/lib/api';
import type { ArchitectureChangeController } from '@/lib/architecture-change';
import type { ArchitectureProposal } from '@/lib/architecture-change-contract';
import type { OverviewChangeState } from '@/lib/overview-change';
import { OverviewChangeComposer } from './OverviewChangeComposer';
import styles from './OverviewChangeComposer.module.css';

type ArchNode = MapprSystem['architecture']['nodes'][number];
type ArchEdge = MapprSystem['architecture']['edges'][number];
function NodeFields({ node }: { node: ArchNode }) {
  return <dl className={styles.nodeFields}>{Object.entries(node).map(([key, value]) => <div key={key}>
    <dt>{key}</dt><dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
  </div>)}</dl>;
}
function Connection({ edge }: { edge: ArchEdge }) {
  return <span><code>{edge.from}</code> → <code>{edge.to}</code>{edge.label != null && edge.label !== '' && <> · {edge.label}</>}</span>;
}
export function ArchitectureChangeDiff({ proposal }: { proposal: ArchitectureProposal }) {
  const { nodes, edges } = proposal.diff.architecture;
  return <div aria-label="Server-returned Architecture diff" className={styles.architectureDiff}>
    {nodes.added.length > 0 && <section aria-label="Added nodes"><h4>Added nodes ({nodes.added.length})</h4>
      {nodes.added.map((n) => <div className={styles.changeRow} key={n.id}><NodeFields node={n} /></div>)}</section>}
    {nodes.changed.length > 0 && <section aria-label="Updated nodes"><h4>Updated nodes ({nodes.changed.length})</h4>
      {nodes.changed.map((change) => <div className={styles.changeRow} key={change.before.id}>
        <p className={styles.meta}>Canonical node <code>{change.before.id}</code> · Changed: {change.changedFields.join(', ')}</p>
        <div className={styles.diff}><div><h4>Before</h4><NodeFields node={change.before} /></div>
          <div className={styles.after}><h4>Proposed</h4><NodeFields node={change.after} /></div></div>
      </div>)}</section>}
    {nodes.removed.length > 0 && <section aria-label="Removed nodes"><h4>Removed nodes ({nodes.removed.length})</h4>
      {nodes.removed.map((n) => <div className={styles.changeRow} key={n.id}><NodeFields node={n} /></div>)}</section>}
    {edges.added.length > 0 && <section aria-label="Added connections"><h4>Added connections ({edges.added.length})</h4>
      <ul>{edges.added.map((edge, index) => <li className={styles.changeRow} key={index}><Connection edge={edge} /></li>)}</ul></section>}
    {edges.removed.length > 0 && <section aria-label="Removed connections"><h4>Removed connections ({edges.removed.length})</h4>
      <ul>{edges.removed.map((edge, index) => <li className={styles.changeRow} key={index}><Connection edge={edge} /></li>)}</ul></section>}
  </div>;
}
export function ArchitectureChangeComposer({ controller, state, selectedNode, targetMode, onTargetMode }: {
  controller: ArchitectureChangeController; state: OverviewChangeState<ArchitectureProposal>;
  selectedNode: ArchNode | null; targetMode: 'whole' | 'selected'; onTargetMode: (mode: 'whole' | 'selected') => void;
}) {
  const scopeId = useId();
  const frozen = state.previewContext?.activeView === 'architecture' ? state.previewContext.selectedTarget : null;
  const unresolved = !!state.proposal && !state.appliedRevision && !state.rejected && !state.expiredByServer;
  const controls = <fieldset className={styles.scopeChoices} disabled={!!state.pending || unresolved}>
    <legend>Change scope</legend>
    <label><input type="radio" name={scopeId} checked={targetMode === 'whole'} onChange={() => onTargetMode('whole')} />Whole architecture</label>
    <label><input type="radio" name={scopeId} checked={targetMode === 'selected'} disabled={!selectedNode} onChange={() => onTargetMode('selected')} />
      {selectedNode ? <>Selected node: {selectedNode.label} · <code>{selectedNode.id}</code></> : 'Select a node in the canvas to target it'}</label>
  </fieldset>;
  const review = state.proposal && <>
    <p className={styles.meta}>Reviewed target: {frozen ? <>canonical node <code>{frozen.id}</code></> : 'whole architecture'}.
      Related changes are listed below; changing graph selection does not retarget this proposal.</p>
    <ArchitectureChangeDiff proposal={state.proposal} />
  </>;
  return <OverviewChangeComposer controller={controller} state={state} scope="architecture" targetControls={controls} reviewDiff={review}
    previewDisabled={targetMode === 'selected' && !selectedNode} />;
}
