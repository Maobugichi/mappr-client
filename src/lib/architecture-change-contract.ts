import type { MapprSystem } from './api';
import type { ChangeContext, ChangeProposal, ChangeReceipt } from './change-protocol';
import { emptySystemDiff } from './change-protocol';
export { emptySystemDiff, assertChangeRejection as assertArchitectureRejection } from './change-protocol';
import { ChangeProtocolError, isMapprSystem, isRevision, sameData } from './overview-change-contract';

export type ArchitectureContext = Extract<ChangeContext, { activeView: 'architecture' }>;
export type ArchitectureChangeRequest = { instruction: string; context: ArchitectureContext; expectedBaseRevision: number };
export type ArchitectureProposal = ChangeProposal & { affectedSections: ['architecture']; context?: ArchitectureContext };
type Architecture = MapprSystem['architecture'];
type ArchNode = Architecture['nodes'][number];
type ArchEdge = Architecture['edges'][number];
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === 'string';
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(string);
const uuid = (v: unknown): v is string => string(v) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const date = (v: unknown) => string(v) && Number.isFinite(Date.parse(v));
const node = (v: unknown): v is ArchNode => object(v) && ['id', 'label', 'type', 'description'].every((key) => string(v[key])) && !!v.id;
const edge = (v: unknown): v is ArchEdge => object(v) && string(v.from) && string(v.to) && (v.label == null || string(v.label));
const edgeKey = (v: ArchEdge) => JSON.stringify([v.from, v.to, v.label ?? '']);
const normalizeEdge = (v: ArchEdge): ArchEdge => v.label == null ? { from: v.from, to: v.to } : v;
const warnings = (v: unknown) => Array.isArray(v) && v.every((w) => object(w) && string(w.code) && string(w.message) && strings(w.sections));

// Nodes and connections have stable identities; their array positions are not
// effects in SystemDiff. The backend can order the committed graph differently
// from this client's review projection. Only sort copies for comparison: keep
// every field, duplicate and the authoritative returned order intact.
function architectureComparisonData(system: MapprSystem): MapprSystem {
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  return { ...system, architecture: { ...system.architecture,
    nodes: [...system.architecture.nodes].sort((a, b) => compare(a.id, b.id)),
    edges: [...system.architecture.edges].sort((a, b) => compare(edgeKey(a), edgeKey(b))),
  } };
}

// This is a read-only projection for review/receipt validation. Operations are
// server-owned and never sent back or executed against the canonical store.
export function architectureCandidate(base: MapprSystem, diff: unknown): MapprSystem {
  const invalid = () => { throw new ChangeProtocolError('The Architecture diff is incomplete, inconsistent, or changes another view. Nothing was installed.'); };
  if (!object(diff) || !sameData({ ...diff, architecture: emptySystemDiff().architecture }, emptySystemDiff()) || !object(diff.architecture)) return invalid();
  const { nodes, edges } = diff.architecture;
  if (!object(nodes) || !object(edges) || !Array.isArray(nodes.added) || !Array.isArray(nodes.removed) || !Array.isArray(nodes.changed)
    || !Array.isArray(edges.added) || !Array.isArray(edges.removed) || Object.keys(nodes).length !== 3 || Object.keys(edges).length !== 2) return invalid();
  const byId = new Map(base.architecture.nodes.map((n) => [n.id, n]));
  if (byId.size !== base.architecture.nodes.length) return invalid();
  const touched = new Set<string>(), removed = new Set<string>(), replacements = new Map<string, ArchNode>();
  for (const n of nodes.removed) {
    if (!node(n) || touched.has(n.id) || !sameData(n, byId.get(n.id))) return invalid();
    touched.add(n.id); removed.add(n.id);
  }
  for (const change of nodes.changed) {
    if (!object(change) || !node(change.before) || !node(change.after) || !strings(change.changedFields)
      || change.before.id !== change.after.id || touched.has(change.before.id) || !sameData(change.before, byId.get(change.before.id))) return invalid();
    const fields = [...new Set([...Object.keys(change.before), ...Object.keys(change.after)])]
      .filter((key) => !sameData((change.before as unknown as Record<string, unknown>)[key], (change.after as unknown as Record<string, unknown>)[key]));
    if (!fields.length || !sameData([...change.changedFields].sort(), fields.sort())) return invalid();
    touched.add(change.before.id); replacements.set(change.after.id, change.after);
  }
  for (const n of nodes.added) {
    if (!node(n) || byId.has(n.id) || touched.has(n.id)) return invalid();
    touched.add(n.id);
  }
  const nextNodes = base.architecture.nodes.filter((n) => !removed.has(n.id)).map((n) => replacements.get(n.id) ?? n).concat(nodes.added as ArchNode[]);
  const nextIds = new Set(nextNodes.map((n) => n.id));
  const oldEdges = new Map(base.architecture.edges.map((e) => [edgeKey(e), e]));
  if (oldEdges.size !== base.architecture.edges.length) return invalid();
  const removedEdges = new Set<string>();
  for (const e of edges.removed) {
    if (!edge(e) || !oldEdges.has(edgeKey(e)) || removedEdges.has(edgeKey(e))) return invalid();
    removedEdges.add(edgeKey(e));
  }
  const nextEdges = base.architecture.edges.filter((e) => !removedEdges.has(edgeKey(e))).map(normalizeEdge);
  const keys = new Set(nextEdges.map(edgeKey));
  for (const e of edges.added) {
    if (!edge(e) || keys.has(edgeKey(e)) || removedEdges.has(edgeKey(e))) return invalid();
    keys.add(edgeKey(e)); nextEdges.push(normalizeEdge(e));
  }
  // Every deleted connection must be visible in the server diff. No hidden cascades.
  if (nextEdges.some((e) => !nextIds.has(e.from) || !nextIds.has(e.to)) || !touched.size && !removedEdges.size && !edges.added.length) return invalid();
  return { ...base, architecture: { ...base.architecture, nodes: nextNodes, edges: nextEdges } };
}

export function assertArchitectureProposal(value: unknown, mapId: string, revision: number, base: MapprSystem, request: ArchitectureChangeRequest): asserts value is ArchitectureProposal {
  if (!object(value) || value.contractVersion !== 1 || value.mapId !== mapId || !uuid(value.proposalId) || value.status !== 'ready'
    || value.baseRevision !== revision || !date(value.createdAt) || !date(value.expiresAt) || Date.parse(String(value.expiresAt)) <= Date.parse(String(value.createdAt))
    || !string(value.summary) || !value.summary.trim() || !Array.isArray(value.operations) || !value.operations.length
    || !sameData(value.affectedSections, ['architecture']) || !warnings(value.warnings) || !Array.isArray(value.artifactImpacts)
    || !value.artifactImpacts.every((i) => object(i) && string(i.artifactType) && string(i.reason) && ['invalidate', 'retain', 'none'].includes(String(i.action)))
    || value.context !== undefined && !sameData(value.context, request.context)) throw new ChangeProtocolError('The server returned an invalid Architecture proposal. Nothing was applied.');
  architectureCandidate(base, value.diff);
}
export function assertArchitectureReceipt(value: unknown, proposal: ArchitectureProposal, base: MapprSystem): asserts value is ChangeReceipt {
  if (!object(value) || value.mapId !== proposal.mapId || value.proposalId !== proposal.proposalId || value.status !== 'applied'
    || value.previousRevision !== proposal.baseRevision || value.revision !== proposal.baseRevision + 1 || value.version !== value.revision
    || !date(value.appliedAt) || !string(value.summary) || !isMapprSystem(value.data) || !sameData(value.diff, proposal.diff)
    || !sameData(value.affectedSections, proposal.affectedSections) || !warnings(value.warnings) || !object(value.artifactFreshness)
    || !Object.values(value.artifactFreshness).every((x) => object(x) && ['fresh', 'stale', 'missing'].includes(String(x.status)) && (x.sourceRevision === null || isRevision(x.sourceRevision)) && string(x.reason))
    || !sameData(architectureComparisonData(value.data), architectureComparisonData(architectureCandidate(base, proposal.diff)))) throw new ChangeProtocolError('The Architecture apply receipt could not be verified. Recover this same proposal outcome before another change.');
}
