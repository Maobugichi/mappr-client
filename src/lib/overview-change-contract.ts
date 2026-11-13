import type { MapprSystem, SystemDiff } from './api';

export type OverviewChangeRequest = {
  instruction: string;
  context: { activeView: 'overview'; selectedTarget: null };
  expectedBaseRevision: number;
};
export type ChangeWarning = { code: string; message: string; sections: string[] };
export type ArtifactFreshness = Record<string, {
  status: 'fresh' | 'stale' | 'missing'; sourceRevision: number | null; reason: string;
}>;
export type OverviewProposal = {
  contractVersion: 1; mapId: string; proposalId: string; status: 'ready';
  baseRevision: number; createdAt: string; expiresAt: string; summary: string;
  operations: [{ op: 'set_field'; path: 'product.summary'; value: string }];
  diff: SystemDiff; affectedSections: ['product']; warnings: ChangeWarning[];
  artifactImpacts: { artifactType: string; action: 'invalidate' | 'retain' | 'none'; reason: string }[];
};
export type OverviewApplyReceipt = {
  mapId: string; proposalId: string; status: 'applied'; previousRevision: number;
  revision: number; version: number; appliedAt: string; summary: string;
  data: MapprSystem; diff: SystemDiff; affectedSections: ['product'];
  warnings: ChangeWarning[]; artifactFreshness: ArtifactFreshness;
};

export class ChangeProtocolError extends Error {}
export const isRevision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const texts = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const list = (value: unknown, check: (item: Record<string, unknown>) => boolean) => Array.isArray(value) && value.every((item) => object(item) && check(item));
const strings = (value: Record<string, unknown>, ...keys: string[]) => keys.every((key) => text(value[key]));

// Check the complete existing canonical shape before allowing a network
// response to replace it. No new defaults or inferred technology data.
export function isMapprSystem(value: unknown): value is MapprSystem {
  if (!object(value)) return false;
  const { meta, product, architecture: a, dataModel: d, designSystem: s } = value;
  return object(meta) && strings(meta, 'productName', 'oneLineSummary')
    && object(product) && text(product.summary) && texts(product.concepts)
    && list(value.users, (x) => strings(x, 'id', 'name', 'description'))
    && list(value.features, (x) => strings(x, 'id', 'name', 'description') && texts(x.relatedUsers) && texts(x.dependsOn))
    && list(value.techStack, (x) => strings(x, 'category', 'choice', 'rationale'))
    && object(a) && list(a.nodes, (x) => strings(x, 'id', 'label', 'type', 'description'))
    && list(a.edges, (x) => strings(x, 'from', 'to') && (x.label === undefined || text(x.label)))
    && object(d) && list(d.entities, (x) => strings(x, 'id', 'name') && list(x.fields, (f) => strings(f, 'name', 'type')))
    && list(d.relations, (x) => strings(x, 'from', 'to') && ['one-to-one', 'one-to-many', 'many-to-many'].includes(String(x.type)) && (x.label === undefined || text(x.label)))
    && object(s) && ['colors', 'typography', 'spacing'].every((key) => list(s[key], (x) => strings(x, 'token', 'value')))
    && list(s.components, (x) => strings(x, 'name', 'description'))
    && list(value.developmentPlan, (x) => isRevision(x.phase) && text(x.title) && list(x.items, (i) => text(i.description) && texts(i.relatedFeatures)));
}

// Property order is irrelevant; array order remains significant.
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameData(v, b[i]));
  if (!object(a) || !object(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameData(a[key], b[key]));
}

function emptyDiff(value: unknown): boolean {
  return Array.isArray(value) ? value.length === 0 : object(value) && Object.values(value).every(emptyDiff);
}
function warnings(value: unknown): boolean {
  return list(value, (x) => strings(x, 'code', 'message') && texts(x.sections));
}
function pilotDiff(diff: unknown, before: string, after: string): boolean {
  if (!object(diff) || diff.hasChanges !== true || !object(diff.product)) return false;
  const summary = diff.product.summary;
  if (!Array.isArray(summary) || summary.length !== 1 || !object(summary[0])
    || summary[0].field !== 'summary' || summary[0].before !== before || summary[0].after !== after) return false;
  // Require every full SystemDiff section, and reject out-of-pilot effects.
  const blankArray = { added: [], removed: [], changed: [] };
  const blankList = { added: [], removed: [] };
  return sameData({ ...diff, product: { ...diff.product, summary: [] } }, {
    hasChanges: true, meta: [], product: { summary: [], concepts: blankList },
    users: blankArray, features: blankArray, techStack: blankArray,
    architecture: { nodes: blankArray, edges: blankList },
    dataModel: { entities: blankArray, relations: blankList },
    designSystem: { colors: blankArray, typography: blankArray, spacing: blankArray, components: blankArray },
    developmentPlan: blankArray,
  }) && emptyDiff(diff.product.concepts);
}

export function assertOverviewProposal(value: unknown, mapId: string, baseRevision: number, base: MapprSystem): asserts value is OverviewProposal {
  if (!object(value) || value.contractVersion !== 1 || value.mapId !== mapId || value.status !== 'ready'
    || !text(value.proposalId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.proposalId)
    || value.baseRevision !== baseRevision || !text(value.summary) || !warnings(value.warnings)
    || !sameData(value.affectedSections, ['product']) || !Array.isArray(value.operations) || value.operations.length !== 1
    || !object(value.operations[0]) || value.operations[0].op !== 'set_field' || value.operations[0].path !== 'product.summary'
    || !text(value.operations[0].value) || !value.operations[0].value.trim() || value.operations[0].value.length > 4000
    || value.operations[0].value === base.product.summary
    || !pilotDiff(value.diff, base.product.summary, value.operations[0].value)
    || !text(value.createdAt) || !text(value.expiresAt) || !Number.isFinite(Date.parse(value.createdAt))
    || !(Date.parse(value.expiresAt) > Date.parse(value.createdAt))
    || !list(value.artifactImpacts, (x) => strings(x, 'artifactType', 'reason') && ['invalidate', 'retain', 'none'].includes(String(x.action)))) {
    throw new ChangeProtocolError('The server returned an invalid or out-of-scope Overview proposal. Nothing was applied.');
  }
}

export function assertApplyReceipt(value: unknown, proposal: OverviewProposal, base: MapprSystem): asserts value is OverviewApplyReceipt {
  const candidate = { ...base, product: { ...base.product, summary: proposal.operations[0].value } };
  if (!object(value) || value.mapId !== proposal.mapId || value.proposalId !== proposal.proposalId || value.status !== 'applied'
    || value.previousRevision !== proposal.baseRevision || value.revision !== proposal.baseRevision + 1 || value.version !== value.revision
    || !text(value.appliedAt) || !Number.isFinite(Date.parse(value.appliedAt)) || !text(value.summary)
    || !isMapprSystem(value.data) || !sameData(value.data, candidate) || !sameData(value.diff, proposal.diff)
    || !sameData(value.affectedSections, ['product']) || !warnings(value.warnings) || !object(value.artifactFreshness)
    || !Object.values(value.artifactFreshness).every((x) => object(x) && ['fresh', 'stale', 'missing'].includes(String(x.status))
      && (x.sourceRevision === null || isRevision(x.sourceRevision)) && text(x.reason))) {
    throw new ChangeProtocolError('The apply response could not be verified. Keep this proposal and retry to recover its outcome.');
  }
}
