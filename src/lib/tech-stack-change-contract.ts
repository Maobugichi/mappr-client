import type { MapprSystem } from './api';
import type { ChangeContext, ChangeProposal, ChangeReceipt } from './change-protocol';
import { emptySystemDiff } from './change-protocol';
import { ChangeProtocolError, isMapprSystem, isRevision, sameData } from './overview-change-contract';

export type TechStackContext = Extract<ChangeContext, { activeView: 'tech-stack' }>;
export type TechStackChangeRequest = { instruction: string; context: TechStackContext; expectedBaseRevision: number };
export type TechStackProposal = ChangeProposal & { affectedSections: ['techStack']; context?: TechStackContext };
type Technology = MapprSystem['techStack'][number];
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const texts = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);
const technology = (v: unknown): v is Technology => object(v) && Object.keys(v).length === 3 && text(v.category) && text(v.choice) && text(v.rationale);
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
const warnings = (v: unknown) => Array.isArray(v) && v.every((w) => object(w) && text(w.code) && text(w.message) && texts(w.sections));

// Review-only projection. The authoritative returned system is installed only
// after Apply, through the existing workspace revision gate.
export function techStackCandidate(base: MapprSystem, diff: unknown): MapprSystem {
  const invalid = (): never => { throw new ChangeProtocolError('The Tech Stack diff is incomplete, inconsistent, or changes another view. Nothing was installed.'); };
  if (!object(diff) || !sameData({ ...diff, techStack: emptySystemDiff().techStack }, emptySystemDiff()) || !object(diff.techStack)) return invalid();
  const { added, removed, changed } = diff.techStack;
  if (!Array.isArray(added) || !Array.isArray(removed) || !Array.isArray(changed) || Object.keys(diff.techStack).length !== 3) return invalid();
  const byCategory = new Map(base.techStack.map((item) => [item.category, item]));
  if (byCategory.size !== base.techStack.length) return invalid();
  const touched = new Set<string>(), deleted = new Set<string>(), replacements = new Map<string, Technology>();
  for (const item of removed) {
    if (!technology(item) || touched.has(item.category) || !sameData(item, byCategory.get(item.category))) return invalid();
    touched.add(item.category); deleted.add(item.category);
  }
  for (const change of changed) {
    if (!object(change) || !technology(change.before) || !technology(change.after) || !texts(change.changedFields)
      || change.before.category !== change.after.category || touched.has(change.before.category) || !sameData(change.before, byCategory.get(change.before.category))) return invalid();
    const before = change.before, after = change.after;
    const fields = (['category', 'choice', 'rationale'] as const).filter((key) => before[key] !== after[key]);
    if (!fields.length || !sameData([...change.changedFields].sort(), fields.sort())) return invalid();
    touched.add(change.before.category); replacements.set(change.after.category, change.after);
  }
  for (const item of added) {
    if (!technology(item) || byCategory.has(item.category) || touched.has(item.category)) return invalid();
    touched.add(item.category);
  }
  if (!touched.size) return invalid();
  return { ...base, techStack: base.techStack.filter((item) => !deleted.has(item.category))
    .map((item) => replacements.get(item.category) ?? item).concat(added as Technology[]) };
}

export function assertTechStackProposal(value: unknown, mapId: string, revision: number, base: MapprSystem, request: TechStackChangeRequest): asserts value is TechStackProposal {
  if (!object(value) || value.contractVersion !== 1 || value.mapId !== mapId || !text(value.proposalId)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.proposalId) || value.status !== 'ready'
    || value.baseRevision !== revision || !date(value.createdAt) || !date(value.expiresAt) || Date.parse(String(value.expiresAt)) <= Date.parse(String(value.createdAt))
    || !text(value.summary) || !value.summary.trim() || !Array.isArray(value.operations) || !value.operations.length
    || !sameData(value.affectedSections, ['techStack']) || !warnings(value.warnings) || !Array.isArray(value.artifactImpacts)
    || !value.artifactImpacts.every((i) => object(i) && text(i.artifactType) && text(i.reason) && ['invalidate', 'retain', 'none'].includes(String(i.action)))
    || value.context !== undefined && !sameData(value.context, request.context)) throw new ChangeProtocolError('The server returned an invalid Tech Stack proposal. Nothing was applied.');
  techStackCandidate(base, value.diff);
}

export function assertTechStackReceipt(value: unknown, proposal: TechStackProposal, base: MapprSystem): asserts value is ChangeReceipt {
  if (!object(value) || value.mapId !== proposal.mapId || value.proposalId !== proposal.proposalId || value.status !== 'applied'
    || value.previousRevision !== proposal.baseRevision || value.revision !== proposal.baseRevision + 1 || value.version !== value.revision
    || !date(value.appliedAt) || !text(value.summary) || !isMapprSystem(value.data) || !sameData(value.diff, proposal.diff)
    || !sameData(value.affectedSections, proposal.affectedSections) || !warnings(value.warnings) || !object(value.artifactFreshness)
    || !Object.values(value.artifactFreshness).every((x) => object(x) && ['fresh', 'stale', 'missing'].includes(String(x.status)) && (x.sourceRevision === null || isRevision(x.sourceRevision)) && text(x.reason))
    || !sameData(value.data, techStackCandidate(base, proposal.diff))) {
    throw new ChangeProtocolError('The Tech Stack apply receipt could not be verified. Recover this same proposal outcome before another change.');
  }
}
