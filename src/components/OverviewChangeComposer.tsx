'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { ArrowRightIcon, CheckIcon, XIcon } from '@phosphor-icons/react';
import type { OverviewChangeController, OverviewChangeState } from '@/lib/overview-change';
import type { ChangeProposal, ChangeRequest } from '@/lib/change-protocol';
import { ActionButton } from './ActionButton';
import styles from './OverviewChangeComposer.module.css';

export function OverviewChangeComposer({ controller, state, scope = 'overview', targetControls, reviewDiff, previewDisabled = false }: {
  controller: Pick<OverviewChangeController<ChangeProposal, ChangeRequest>, 'setDraft' | 'activate' | 'preview' | 'apply' | 'reject' | 'discard' | 'canApply'>;
  state: OverviewChangeState<ChangeProposal>;
  scope?: 'overview' | 'architecture' | 'tech-stack'; targetControls?: ReactNode; reviewDiff?: ReactNode;
  previewDisabled?: boolean;
}) {
  const id = useId();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state.proposal && !state.retry) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.proposal, state.retry]);
  const p = state.proposal;
  const expired = !!p && Date.parse(p.expiresAt) <= now + state.serverOffset;
  const obsolete = !!p && p.baseRevision !== state.canonical.revision;
  const busy = state.pending !== null;
  const owner = state.eligibility === 'owner';
  const recoverApply = state.retry?.kind === 'apply';
  const recoverReject = state.retry?.kind === 'reject';
  const architecture = scope === 'architecture';
  const techStack = scope === 'tech-stack';
  const reviewedScope = architecture || techStack;
  const label = techStack ? 'Tech Stack' : architecture ? 'Architecture' : 'Overview';
  const requiresDecision = reviewedScope && !!p && !state.appliedRevision && !state.rejected && !state.expiredByServer;
  const retryReady = !!state.retry && now >= state.retry.notBefore;
  const validInstruction = state.draft.trim().length > 0 && state.draft.trim().length <= 2000;
  const issue = state.proposalIssue ?? (obsolete ? 'The map has changed since this preview. Request a new preview before approving.'
    : expired ? 'This preview has expired. Request a new preview explicitly to continue.' : null);

  return <section className={styles.composer} aria-labelledby={`${id}-heading`}>
    <header className={styles.header}>
      <div>
        <p className={styles.scope}>{reviewedScope ? `${label} · Review before applying` : 'Overview pilot · Product summary'}</p>
        <h2 id={`${id}-heading`} className={styles.title}>Describe a Change</h2>
      </div>
      <span className={styles.meta}>{state.canonical.revision === null ? 'Revision unavailable' : `Revision ${state.canonical.revision}`}</span>
    </header>
    <p id={`${id}-scope`} className={styles.description}>
      {techStack ? 'Propose changes to the technology inventory. Review the category, technology choice, and rationale for every proposed change before applying.'
        : architecture ? 'Propose a change to the whole architecture or a selected canonical node. Review every proposed node and connection change before applying.'
        : 'Propose a change to the product summary. Review the server proposal before applying; features and the technical design remain outside this pilot.'}
    </p>
    <p role="status" className={styles.meta}>{state.eligibilityMessage}</p>
    {targetControls}
    <form className={styles.form} aria-busy={state.pending === 'preview'} onSubmit={(event) => {
      event.preventDefault();
      if (owner && validInstruction && !busy && !recoverApply && !recoverReject && !requiresDecision && !previewDisabled) void controller.preview();
    }}>
      <label htmlFor={`${id}-instruction`}>Change instruction</label>
      <textarea id={`${id}-instruction`} value={state.draft} maxLength={2000} rows={3}
        aria-describedby={`${id}-scope`} placeholder={techStack ? 'Describe the technology choices or rationale you want to change…' : architecture ? 'Describe the node or connection changes you want to review…' : 'Clarify who the product serves and what it helps them do…'}
        disabled={!owner || busy} onChange={(event) => controller.setDraft(event.target.value)} />
      <div className={styles.actions}>
        <ActionButton type="submit" compactPending idleLabel={p ? 'New preview' : 'Preview change'} pendingLabel={`Generating ${label} proposal`}
          icon={<ArrowRightIcon size={14} aria-hidden="true" />} state={state.pending === 'preview' ? 'pending' : 'idle'}
          disabled={!owner || busy || !validInstruction || recoverApply || recoverReject || requiresDecision || previewDisabled} />
        {state.retry?.kind === 'preview' && <button type="button" className={styles.secondary} disabled={busy || !owner || !retryReady}
          onClick={() => void controller.preview(true)}>Retry same preview</button>}
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => void controller.activate()}>
          {owner ? 'Refresh access & revision' : 'Check editing access'}
        </button>
      </div>
      {state.retry?.kind === 'preview' && <p className={styles.meta}>Retry checks the original request using the same identity. New preview starts a separate generation attempt.</p>}
      {requiresDecision && <p className={styles.meta}>Apply or reject the existing proposal before starting another preview.{architecture && ' Its original target remains fixed when graph selection changes.'}</p>}
    </form>

    {state.feedback && <p role={state.feedback.error ? 'alert' : 'status'} className={state.feedback.error ? styles.error : styles.success}>
      {state.feedback.message}{state.feedback.requestId && <span className={styles.request}>Request: {state.feedback.requestId}</span>}
    </p>}
    {state.refreshRequired && owner && !busy && <p className={styles.meta}>A current revision must be refreshed before another change can be proposed.</p>}

    {p && <section className={styles.review} aria-labelledby={`${id}-review`}>
      <header className={styles.header}>
        <h3 id={`${id}-review`} className={styles.title}>{state.appliedRevision !== null ? 'Applied change' : state.rejected ? 'Rejected proposal' : 'Review proposed change'}</h3>
        <span className={styles.meta}>Based on revision {p.baseRevision}</span>
      </header>
      <p className={styles.description}>{p.summary}</p>
      <p className={styles.meta}>Expires <time dateTime={p.expiresAt}>{new Date(p.expiresAt).toLocaleString()}</time>. The server determines approval eligibility.</p>
      {reviewedScope ? reviewDiff : <div className={styles.diff} aria-label="Server-returned product summary diff">
        <div><h4>Before</h4><p>{String(p.diff.product.summary[0].before)}</p></div>
        <div className={styles.after}><h4>Proposed summary</h4><p>{String(p.diff.product.summary[0].after)}</p></div>
      </div>}
      <p className={styles.meta}>{techStack ? <>Affected section: Tech Stack · <code>techStack</code></> : architecture ? 'Affected section: Architecture · nodes and connections' : <>Affected section: Product · <code>product.summary</code></>}</p>
      {p.warnings.length > 0 && <div className={styles.notices}>
        <h4>Server warnings</h4>
        <ul>{p.warnings.map((warning, i) => <li key={`${warning.code}-${i}`}>{warning.message}
          {warning.sections.length > 0 && <span className={styles.meta}> · {warning.sections.join(', ')}</span>}
        </li>)}</ul>
      </div>}
      {p.artifactImpacts.length > 0 && <div className={styles.notices}>
        <h4>Predicted artifact impacts</h4>
        <p className={styles.meta}>These predictions can change before approval. Applying does not regenerate artifacts.</p>
        <ul>{p.artifactImpacts.map((impact, i) => <li key={`${impact.artifactType}-${i}`}>
          <code>{impact.artifactType}</code> — {impact.action} <span className={styles.meta}>({impact.reason})</span>
        </li>)}</ul>
      </div>}
      {issue && state.appliedRevision === null && !state.rejected && <p role="status" className={styles.error}>{issue}</p>}
      {recoverApply && <p className={styles.meta}>The previous approval may already have committed. Recover its receipt before starting another change, even if this preview has expired.</p>}
      {recoverReject && <p className={styles.meta}>The rejection outcome is uncertain. Retry rejection of this same proposal; it cannot be applied while recovery is pending.</p>}
      <div className={styles.actions}>
        {state.appliedRevision === null && !state.rejected && <ActionButton compactPending
          idleLabel={recoverApply ? 'Recover apply outcome' : 'Apply approved change'} pendingLabel={`Applying approved ${label} change`}
          state={state.pending === 'apply' ? 'pending' : 'idle'} icon={<CheckIcon size={14} aria-hidden="true" />}
          disabled={busy || !owner || (recoverApply ? !retryReady : !!issue || !controller.canApply())}
          onClick={() => void controller.apply(recoverApply)} />}
        {reviewedScope && requiresDecision && <ActionButton compactPending variant="secondary"
          icon={<XIcon size={14} aria-hidden="true" />}
          idleLabel={recoverReject ? 'Retry rejection' : 'Reject proposal'} pendingLabel={`Rejecting ${label} proposal`}
          state={state.pending === 'reject' ? 'pending' : 'idle'} disabled={busy || !owner || recoverApply || recoverReject && !retryReady}
          onClick={() => void controller.reject(recoverReject)} />}
        {(!reviewedScope || !requiresDecision) && <button type="button" className={styles.secondary} disabled={busy || recoverApply || recoverReject} onClick={controller.discard}>
          {state.appliedRevision !== null || reviewedScope ? 'Close review' : 'Discard preview'}
        </button>}
      </div>
      {state.artifactFreshness && <div className={styles.notices}>
        <h4>Artifact freshness at apply</h4>
        <p className={styles.meta}>Saved output was not regenerated. These are commit-time results, not live export guarantees.</p>
        <ul>{Object.entries(state.artifactFreshness).map(([name, value]) => <li key={name}>
          <code>{name}</code> — {value.status}<span className={styles.meta}> · {value.sourceRevision === null ? 'Source revision unverified' : `Source revision ${value.sourceRevision}`} · {value.reason}</span>
        </li>)}</ul>
      </div>}
      {state.appliedRevision !== null && state.appliedWarnings.length > 0 && <div className={styles.notices}>
        <h4>Warnings at apply</h4>
        <ul>{state.appliedWarnings.map((warning, i) => <li key={`${warning.code}-${i}`}>{warning.message}
          {warning.sections.length > 0 && <span className={styles.meta}> · {warning.sections.join(', ')}</span>}
        </li>)}</ul>
      </div>}
    </section>}
  </section>;
}
