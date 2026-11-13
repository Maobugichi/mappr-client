import {
  ApiError, applyOverviewChange, getChangeMap, getEditEligibility, previewOverviewChange,
  type MapprSystem,
} from './api';
import {
  assertApplyReceipt, assertOverviewProposal, ChangeProtocolError, isMapprSystem, isRevision, sameData,
  type ArtifactFreshness, type ChangeWarning, type OverviewChangeRequest, type OverviewProposal,
} from './overview-change-contract';
import type { ChangeContext, ChangeProposal, ChangeProtocol, ChangeRequest } from './change-protocol';

type Attempt<R extends ChangeRequest> = { key: string; body: R; base: MapprSystem };
const overviewProtocol: ChangeProtocol<OverviewProposal, OverviewChangeRequest> = {
  scope: 'overview', label: 'Overview', context: () => ({ activeView: 'overview', selectedTarget: null }),
  request: (instruction, revision, context) => ({ instruction, context, expectedBaseRevision: revision }),
  preview: previewOverviewChange, validateProposal: assertOverviewProposal,
  apply: applyOverviewChange, validateReceipt: assertApplyReceipt,
};
type Feedback = { message: string; requestId?: string; error: boolean };
export type OverviewChangeState<P extends ChangeProposal = OverviewProposal> = {
  canonical: { data: MapprSystem; revision: number | null };
  eligibility: 'unknown' | 'checking' | 'owner' | 'denied';
  eligibilityMessage: string;
  draft: string;
  pending: 'refresh' | 'preview' | 'apply' | 'reject' | null;
  proposal: P | null;
  proposalIssue: string | null;
  appliedRevision: number | null;
  feedback: Feedback | null;
  retry: { kind: 'preview' | 'apply' | 'reject'; notBefore: number } | null;
  refreshRequired: boolean;
  serverOffset: number;
  artifactFreshness: ArtifactFreshness | null;
  artifactsMayBeStale: boolean;
  appliedWarnings: ChangeWarning[];
  rejected: boolean;
  expiredByServer: boolean;
  previewContext: ChangeContext | null;
};

// One small controller is owned by the existing workspace, not by a tab or a
// module-global cache. Its canonical snapshot is the workspace's only store.
export class OverviewChangeController<P extends ChangeProposal = OverviewProposal, R extends ChangeRequest = OverviewChangeRequest> {
  readonly mapId: string;
  private state: OverviewChangeState<P>;
  private listeners = new Set<() => void>();
  private epoch = 0;
  private alive = true;
  private attempt: Attempt<R> | null = null;
  private protocol: ChangeProtocol<P, R>;
  private authority?: OverviewChangeController;
  private unsubscribeAuthority?: () => void;

  constructor(mapId: string, data: MapprSystem, revision?: number, options?: { protocol: ChangeProtocol<P, R>; authority: OverviewChangeController }) {
    this.mapId = mapId;
    this.protocol = options?.protocol ?? overviewProtocol as unknown as ChangeProtocol<P, R>;
    this.authority = options?.authority;
    this.state = {
      canonical: { data, revision: isRevision(revision) ? revision : null },
      eligibility: 'unknown', eligibilityMessage: 'Editing eligibility has not been established.',
      draft: '', pending: null, proposal: null, proposalIssue: null, appliedRevision: null,
      feedback: null, retry: null, refreshRequired: true, serverOffset: 0, artifactFreshness: null,
      artifactsMayBeStale: false, appliedWarnings: [],
      rejected: false, expiredByServer: false, previewContext: null,
    };
  }
  getSnapshot = () => this.state;
  getRevision = () => this.state.canonical.revision;
  refreshForArtifacts = async () => {
    const epoch = this.epoch;
    const { data } = await getChangeMap(this.mapId);
    if (!this.current(epoch)) throw new ChangeProtocolError('The map/session changed.');
    const result = this.acceptCanonical(data.id, data.data, data.revision);
    if (result === 'invalid' || result === 'older') throw new ChangeProtocolError('A coherent current map revision is required.');
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(patch: Partial<OverviewChangeState<P>>) {
    if (!this.alive) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private syncAuthority = () => {
    if (!this.authority || !this.alive) return;
    const root = this.authority.getSnapshot();
    if (root.canonical !== this.state.canonical) this.publish({ canonical: root.canonical, artifactFreshness: null, artifactsMayBeStale: root.artifactsMayBeStale });
    if (root.eligibility === 'denied' && this.state.eligibility !== 'denied') this.clearAuthorization();
  };
  retain = () => {
    this.alive = true;
    if (this.authority && !this.unsubscribeAuthority) this.unsubscribeAuthority = this.authority.subscribe(this.syncAuthority);
    this.syncAuthority();
  };
  release = () => {
    this.alive = false;
    this.unsubscribeAuthority?.();
    this.unsubscribeAuthority = undefined;
    this.epoch++;
    this.attempt = null;
    this.state = { ...this.state, eligibility: 'unknown', pending: null, proposal: null, retry: null };
  };
  private current(epoch: number) { return this.alive && epoch === this.epoch; }
  setDraft = (draft: string) => { this.publish({ draft }); };
  private clearAuthorization = () => {
    this.epoch++; this.attempt = null;
    this.publish({ eligibility: 'denied', eligibilityMessage: 'Editing is unavailable for this session. Reading remains available.',
      pending: null, proposal: null, retry: null, appliedRevision: null, previewContext: null });
  };
  invalidateAuthorization = () => { this.authority?.invalidateAuthorization(); this.clearAuthorization(); };

  // Every canonical writer and browser GET goes through this gate. A replay
  // can confirm its outcome without replacing a more recent accepted snapshot.
  acceptCanonical = (mapId: string, data: MapprSystem, revision: number | undefined): 'newer' | 'same' | 'older' | 'invalid' => {
    if (!this.alive || mapId !== this.mapId) return 'invalid';
    if (this.authority) {
      const result = this.authority.acceptCanonical(mapId, data, revision);
      this.syncAuthority();
      return result;
    }
    if (!isRevision(revision) || !isMapprSystem(data)) {
      this.publish({ refreshRequired: true, feedback: { error: true, message: 'A map response has no valid revision or complete system data. Refresh before proposing a change.' } });
      return 'invalid';
    }
    const previous = this.state.canonical;
    if (previous.revision !== null && revision < previous.revision) return 'older';
    if (revision === previous.revision) {
      if (!sameData(data, previous.data)) {
        this.publish({ refreshRequired: true, feedback: { error: true, message: 'Conflicting data was returned for the same revision. The accepted map was preserved; refresh before editing.' } });
        return 'invalid';
      }
      return 'same';
    }
    this.publish({ canonical: { data, revision }, refreshRequired: false, artifactFreshness: null,
      artifactsMayBeStale: this.state.artifactsMayBeStale || !sameData(previous.data, data) });
    return 'newer';
  };
  acceptIteration = (data: MapprSystem, revision: number, responseMapId: string) => {
    this.acceptCanonical(responseMapId, data, revision);
  };

  private confirmOwner() {
    this.publish({ eligibility: 'owner', eligibilityMessage: `Owner session confirmed. ${this.protocol.scope === 'overview' ? 'Overview summary only.' : `${this.protocol.label} changes require review and approval.`}` });
  }
  private async owner(epoch: number) {
    this.publish({ eligibility: 'checking', eligibilityMessage: 'Checking editing eligibility…' });
    try {
      const { data } = await getEditEligibility(this.mapId);
      if (!this.current(epoch)) return false;
      if (data?.mapId !== this.mapId || data.canEdit !== true) throw new ChangeProtocolError('The server did not confirm editing eligibility.');
      // Access loss retires artifact scopes across the workspace. A successful
      // recheck in either composer must also restore that shared session state.
      this.authority?.confirmOwner();
      this.confirmOwner();
      return true;
    } catch (error) {
      if (!this.current(epoch)) return false;
      const denied = error instanceof ApiError && [401, 403, 404].includes(error.status);
      if (denied) this.invalidateAuthorization();
      this.publish({
        eligibility: denied ? 'denied' : 'unknown',
        ...(denied ? { proposal: null, retry: null, appliedRevision: null } : {}),
        eligibilityMessage: denied ? 'Editing is unavailable for this session. You can continue reading this map.'
          : 'Editing eligibility could not be established. You can continue reading this map.',
        feedback: this.feedback(error, 'Could not verify the owner session. Check cookie delivery and the configured frontend origin.'),
      });
      return false;
    }
  }
  private async refreshMap(epoch: number) {
    const { data } = await getChangeMap(this.mapId);
    if (!this.current(epoch)) return false;
    const result = this.acceptCanonical(data.id, data.data, data.revision);
    if (result === 'invalid' || result === 'older') {
      this.publish({ refreshRequired: true });
      throw new ChangeProtocolError('Could not obtain a coherent current map revision. The accepted map is unchanged; refresh before editing.');
    }
    this.publish({ refreshRequired: false });
    return true;
  }
  private feedback(error: unknown, fallback: string): Feedback {
    if (error instanceof ApiError) {
      const unavailable = ['feature_disabled', 'preview_policy_not_configured', 'revision_not_ready'].includes(error.body.error);
      return { error: true, requestId: error.body.requestId,
        message: unavailable ? `${this.protocol.label} changes are currently unavailable (${error.body.error}). ${error.body.message ?? ''}`
          : `${error.body.message ?? error.body.error} (${error.body.error})` };
    }
    return { error: true, message: error instanceof ChangeProtocolError ? error.message : fallback };
  }

  activate = async () => {
    if (this.state.pending || !this.alive) return;
    const epoch = this.epoch;
    this.publish({ pending: 'refresh' });
    try {
      if (await this.owner(epoch)) await this.refreshMap(epoch);
    } catch (error) {
      if (this.current(epoch)) this.publish({ refreshRequired: true, feedback: this.feedback(error, 'Could not refresh the map. Your draft is preserved.') });
    } finally {
      if (this.current(epoch)) this.publish({ pending: null });
    }
  };

  discard = () => {
    if (this.state.pending || this.state.retry?.kind === 'apply' || this.state.retry?.kind === 'reject') return;
    if (this.protocol.reject && this.state.proposal && !this.state.appliedRevision && !this.state.rejected && !this.state.expiredByServer) return;
    this.attempt = null;
    this.publish({ proposal: null, proposalIssue: null, appliedRevision: null, retry: null, feedback: null, rejected: false, expiredByServer: false, previewContext: null });
  };

  preview = async (retry = false) => {
    if (!this.alive || this.state.pending || this.state.retry?.kind === 'apply' || this.state.retry?.kind === 'reject') return;
    if (this.protocol.reject && this.state.proposal && !this.state.appliedRevision && !this.state.rejected && !this.state.expiredByServer) return;
    if (retry && (!this.attempt || this.state.retry?.kind !== 'preview' || Date.now() < this.state.retry.notBefore)) return;
    const instruction = this.state.draft.trim();
    if (!retry && (!instruction || instruction.length > 2000)) return;
    const epoch = this.epoch;
    let requested = false;
    this.publish({ pending: 'preview', feedback: null });
    try {
      const context: R['context'] = retry && this.attempt ? this.attempt.body.context : this.protocol.context();
      // Refresh both access and revision before admitting an intentional new
      // preview. Retried attempts keep their original body and identity.
      if (!await this.owner(epoch) || !await this.refreshMap(epoch) || !this.current(epoch)) return;
      if (retry && this.attempt?.body.expectedBaseRevision !== this.state.canonical.revision) {
        this.publish({ retry: null, proposalIssue: 'The map changed. Request a new preview explicitly.', feedback: { error: true, message: 'The previous preview attempt is obsolete. Your instruction is preserved.' } });
        return;
      }
      if (!retry) {
        const { data, revision } = this.state.canonical;
        if (revision === null) return;
        if (typeof crypto.randomUUID !== 'function') throw new ChangeProtocolError('Preview requires a secure browser context with request identity support. No preview was requested.');
        this.attempt = { key: crypto.randomUUID(), base: data, body: this.protocol.request(instruction, revision, context, data) };
        this.publish({ proposal: null, proposalIssue: null, appliedRevision: null, appliedWarnings: [], retry: null, rejected: false, expiredByServer: false, previewContext: null });
      }
      const attempt = this.attempt;
      if (!attempt) return;
      requested = true;
      const result = await this.protocol.preview(this.mapId, attempt.body, attempt.key);
      if (!this.current(epoch)) return;
      this.protocol.validateProposal(result.data, this.mapId, attempt.body.expectedBaseRevision, attempt.base, attempt.body);
      this.publish({ proposal: result.data, previewContext: attempt.body.context, retry: null, serverOffset: result.serverTime === null ? 0 : result.serverTime - Date.now() });
    } catch (error) {
      if (this.current(epoch)) {
        if (requested) await this.handleError(error, 'preview', epoch);
        else this.publish({ refreshRequired: true, feedback: this.feedback(error, 'Could not refresh the map. Your instruction is preserved; no preview was requested.') });
      }
    } finally {
      if (this.current(epoch)) this.publish({ pending: null });
    }
  };

  apply = async (retry = false) => {
    const proposal = this.state.proposal, attempt = this.attempt;
    if (!this.alive || this.state.pending || !proposal || !attempt) return;
    if (retry ? this.state.retry?.kind !== 'apply' || Date.now() < this.state.retry.notBefore : !this.canApply()) return;
    const epoch = this.epoch;
    this.publish({ pending: 'apply', feedback: null });
    try {
      if (!await this.owner(epoch) || !this.current(epoch)) return;
      // A recovery retry is allowed even after local expiry/revision changes:
      // the server checks an existing receipt before expiry/current revision.
      if (!retry && !this.canApply()) return;
      const result = await this.protocol.apply(this.mapId, proposal.proposalId, proposal.baseRevision);
      if (!this.current(epoch)) return;
      this.protocol.validateReceipt(result.data, proposal, attempt.base);
      const receipt = result.data;
      const accepted = this.acceptCanonical(receipt.mapId, receipt.data, receipt.revision);
      if (accepted === 'invalid') throw new ChangeProtocolError('The apply receipt conflicts with the accepted map. Retry to recover the outcome, then refresh.');
      this.publish({
        appliedRevision: receipt.revision, retry: null, proposalIssue: null, appliedWarnings: receipt.warnings,
        draft: this.state.draft.trim() === attempt.body.instruction ? '' : this.state.draft,
        artifactFreshness: accepted === 'newer' ? receipt.artifactFreshness : this.state.artifactFreshness,
        feedback: { error: false, message: accepted === 'older'
          ? `The change was applied at revision ${receipt.revision}. Newer revision ${this.state.canonical.revision} remains displayed.`
          : `Applied at revision ${receipt.revision}. ${receipt.summary}` },
        refreshRequired: true,
      });
      // Receipt freshness is commit-time metadata, not a promise of current
      // generated output. Re-read before allowing another edit.
      try { await this.refreshMap(epoch); } catch {
        if (this.current(epoch)) this.publish({ refreshRequired: true, feedback: {
          error: true, message: `The change was applied at revision ${receipt.revision}, but the latest map could not be refreshed. Refresh before another edit.`,
        } });
      }
    } catch (error) {
      if (this.current(epoch)) await this.handleError(error, 'apply', epoch);
    } finally {
      if (this.current(epoch)) this.publish({ pending: null });
    }
  };

  reject = async (retry = false) => {
    const proposal = this.state.proposal;
    if (!this.alive || !this.protocol.reject || this.state.pending || !proposal || this.state.appliedRevision || this.state.rejected
      || this.state.retry?.kind === 'apply' || this.state.eligibility !== 'owner') return;
    if (retry ? this.state.retry?.kind !== 'reject' || Date.now() < this.state.retry.notBefore : this.state.retry?.kind === 'reject') return;
    const epoch = this.epoch;
    this.publish({ pending: 'reject', feedback: null });
    try {
      if (!await this.owner(epoch) || !this.current(epoch)) return;
      await this.protocol.reject(this.mapId, proposal.proposalId, proposal.baseRevision);
      if (!this.current(epoch)) return;
      this.publish({ rejected: true, retry: null, feedback: { error: false, message: 'Proposal rejected. The canonical map was not changed.' } });
    } catch (error) {
      if (this.current(epoch)) await this.handleError(error, 'reject', epoch);
    } finally { if (this.current(epoch)) this.publish({ pending: null }); }
  };

  canApply = () => {
    const s = this.state, p = s.proposal;
    return s.eligibility === 'owner' && !!p && !s.appliedRevision && !s.rejected && !s.expiredByServer && !s.proposalIssue && !s.refreshRequired
      && s.retry?.kind !== 'apply' && s.retry?.kind !== 'reject' && p.baseRevision === s.canonical.revision && Date.parse(p.expiresAt) > Date.now() + s.serverOffset;
  };

  private async handleError(error: unknown, kind: 'preview' | 'apply' | 'reject', epoch: number) {
    const api = error instanceof ApiError ? error : null;
    const code = api?.body.error;
    this.publish({ feedback: this.feedback(error, kind === 'reject' ? 'The rejection outcome is uncertain. Retry rejection of this same proposal.' : kind === 'apply'
      ? 'The apply outcome is uncertain. Retry this same approval to recover its receipt.'
      : 'The preview outcome is uncertain. Retry the same request to check without generating another attempt.') });
    if (api && [401, 403, 404].includes(api.status)) {
      this.invalidateAuthorization();
      this.publish({ eligibility: 'denied', eligibilityMessage: 'Editing is unavailable for this session. Reading remains available.', proposal: null, retry: null });
      return;
    }
    if (code === 'revision_conflict' || api?.body.retry === 'refresh_map') {
      this.publish({ retry: null, refreshRequired: true, proposalIssue: 'The map changed. Generate a new preview before approving.' });
      try { await this.refreshMap(epoch); } catch { /* Keep original error and explicit refresh requirement. */ }
      return;
    }
    if (code === 'proposal_expired') {
      this.publish({ retry: null, expiredByServer: true, proposalIssue: 'This proposal expired. Its diff remains available; request a new preview explicitly.' });
      return;
    }
    if (code === 'proposal_rejected') {
      this.publish({ retry: null, rejected: true, proposalIssue: 'The server reports this proposal was rejected.' });
      return;
    }
    const unavailable = ['feature_disabled', 'preview_policy_not_configured', 'revision_not_ready'].includes(code ?? '');
    // An HTTP/proxy failure is not evidence of rollback. Even a contradictory
    // generic retry hint cannot authorize a second approval/generation identity.
    if (api?.status === 500 || ((kind === 'apply' || kind === 'reject') && api && api.status >= 500 && !unavailable)) {
      this.publish({ retry: { kind, notBefore: Date.now() + api.retryAfterMs } });
      return;
    }
    const blocked = api && (api.body.retry === 'none' || api.body.retry === 'new_preview'
      || [400, 422, 502].includes(api.status) || ['feature_disabled', 'preview_policy_not_configured', 'revision_not_ready',
        'idempotency_key_reused', 'proposal_mismatch', 'proposal_obsolete', 'proposal_not_ready'].includes(code ?? ''));
    if (blocked || (error instanceof ChangeProtocolError && kind === 'preview')) {
      this.publish({ retry: null, ...(kind === 'apply' ? { proposalIssue: 'This proposal cannot be applied. Review the error and request a new preview.' } : {}) });
      return;
    }
    this.publish({ retry: { kind, notBefore: Date.now() + (api?.retryAfterMs ?? 0) } });
  }
}
