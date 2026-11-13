import type { ChangeHttpResult, MapprSystem, SystemDiff } from './api';
import type { ArtifactFreshness, ChangeWarning } from './overview-change-contract';
import { ChangeProtocolError, isRevision } from './overview-change-contract';

export type ChangeContext = { activeView: 'overview'; selectedTarget: null }
  | { activeView: 'tech-stack'; selectedTarget: null }
  | { activeView: 'architecture'; selectedTarget: null | { kind: 'architecture_node'; id: string } };
export type ChangeRequest = { instruction: string; context: ChangeContext; expectedBaseRevision: number };
export type ChangeProposal = {
  contractVersion: 1; mapId: string; proposalId: string; status: 'ready'; baseRevision: number;
  createdAt: string; expiresAt: string; summary: string; operations: readonly unknown[];
  diff: SystemDiff; affectedSections: string[]; warnings: ChangeWarning[];
  artifactImpacts: { artifactType: string; action: 'invalidate' | 'retain' | 'none'; reason: string }[];
};
export type ChangeReceipt = {
  mapId: string; proposalId: string; status: 'applied'; previousRevision: number;
  revision: number; version: number; appliedAt: string; summary: string; data: MapprSystem;
  diff: SystemDiff; affectedSections: string[]; warnings: ChangeWarning[]; artifactFreshness: ArtifactFreshness;
};
export type ChangeRejection = {
  contractVersion: 1; mapId: string; proposalId: string; status: 'rejected'; baseRevision: number; rejectedAt: string;
};
export type ChangeProtocol<P extends ChangeProposal, R extends ChangeRequest> = {
  scope: ChangeContext['activeView']; label: string;
  context: () => R['context'];
  request: (instruction: string, revision: number, context: R['context'], base: MapprSystem) => R;
  preview: (mapId: string, request: R, key: string) => Promise<ChangeHttpResult<P>>;
  validateProposal: (value: unknown, mapId: string, revision: number, base: MapprSystem, request: R) => asserts value is P;
  apply: (mapId: string, proposalId: string, revision: number) => Promise<ChangeHttpResult<ChangeReceipt>>;
  validateReceipt: (value: unknown, proposal: P, base: MapprSystem) => asserts value is ChangeReceipt;
  reject?: (mapId: string, proposalId: string, baseRevision: number) => Promise<ChangeHttpResult<ChangeRejection>>;
};

export function emptySystemDiff(): SystemDiff {
  const array = () => ({ added: [], removed: [], changed: [] });
  const list = () => ({ added: [], removed: [] });
  return { hasChanges: true, meta: [], product: { summary: [], concepts: list() }, users: array(), features: array(), techStack: array(),
    architecture: { nodes: array(), edges: list() }, dataModel: { entities: array(), relations: list() },
    designSystem: { colors: array(), typography: array(), spacing: array(), components: array() }, developmentPlan: array() };
}

export function assertChangeRejection(value: unknown, mapId: string, proposalId: string, baseRevision: number): asserts value is ChangeRejection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ChangeProtocolError('The rejection outcome could not be verified. Retry rejection of this same proposal.');
  const receipt = value as Record<string, unknown>;
  if (receipt.contractVersion !== 1 || receipt.status !== 'rejected' || receipt.mapId !== mapId || receipt.proposalId !== proposalId
    || !isRevision(receipt.baseRevision) || receipt.baseRevision !== baseRevision || typeof receipt.rejectedAt !== 'string'
    || !Number.isFinite(Date.parse(receipt.rejectedAt))) {
    throw new ChangeProtocolError('The rejection outcome could not be verified. Retry rejection of this same proposal.');
  }
}
