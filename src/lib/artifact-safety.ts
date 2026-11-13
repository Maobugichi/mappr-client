export const ARTIFACT_ROUTES = {
  api_contract: 'api-contract', relational_schema: 'relational-schema', document_schema: 'document-schema',
  readme: 'readme', adrs: 'adrs', env_vars: 'env-vars', deployment: 'deployment',
  critique: 'critique', requirements: 'requirements', traceability: 'traceability',
} as const;
export type ArtifactKind = keyof typeof ARTIFACT_ROUTES;
export type ArtifactReadMode = 'current' | 'inspection';
export type ArtifactExportExpectation = { currentRevision: number; generationId?: string | null };
export type ArtifactMetadata = {
  mapId: string; currentRevision: number; sourceRevision: number | null;
  freshness: { status: 'fresh' | 'stale' | 'missing'; reason: string };
  isCurrent: boolean; inspectionOnly: boolean; readMode: 'tracked';
  generationId?: string | null; sourceFingerprint?: string | null;
  generatorVersion?: string | null; publishedAt?: string | null;
};
export class ArtifactSafetyError extends Error {
  readonly code: string;
  constructor(message: string, code = 'artifact_unverified') { super(message); this.code = code; }
}
export class ArtifactMutationError extends Error {
  readonly currentRecord: unknown;
  constructor(readonlyCause: unknown, currentRecord: unknown, readCause?: unknown) {
    const message = readonlyCause instanceof Error ? readonlyCause.message : 'The mutation outcome could not be confirmed.';
    super(`${message} Tracked output was checked; refresh before deliberately retrying generation.${readCause ? ' Current output is unavailable.' : ''}`);
    this.currentRecord = currentRecord;
  }
}
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const reasons = ['inputs_unchanged', 'source_changed', 'generator_changed', 'payload_changed', 'provenance_unknown', 'not_generated'];

export function assertTrackedArtifact(value: unknown, mapId: string, mode: ArtifactReadMode = 'current'): asserts value is ArtifactMetadata {
  if (!object(value) || value.mapId !== mapId || value.readMode !== 'tracked' || !positive(value.currentRevision)
    || !(value.sourceRevision === null || positive(value.sourceRevision) && value.sourceRevision <= value.currentRevision)
    || !object(value.freshness) || !reasons.includes(String(value.freshness.reason))
    || !['fresh', 'stale'].includes(String(value.freshness.status))
    || typeof value.isCurrent !== 'boolean' || typeof value.inspectionOnly !== 'boolean') {
    throw new ArtifactSafetyError('Unavailable: the server did not provide valid tracked provenance. Legacy output is not currentness proof.');
  }
  const current = value.freshness.status === 'fresh' && value.freshness.reason === 'inputs_unchanged'
    && value.sourceRevision !== null && value.isCurrent === true && value.inspectionOnly === false;
  const inspection = value.freshness.status === 'stale' && value.isCurrent === false && value.inspectionOnly === true;
  if (!current && !(mode === 'inspection' && inspection)) throw new ArtifactSafetyError('Saved output is not verified current. Refresh or explicitly inspect the saved artifact.', 'artifact_stale');
  for (const key of ['sourceFingerprint', 'generatorVersion']) {
    if (value[key] !== undefined && value[key] !== null && (typeof value[key] !== 'string' || !value[key])) throw new ArtifactSafetyError('Unavailable: invalid artifact provenance.');
  }
  if (value.generationId !== undefined && value.generationId !== null
    && (typeof value.generationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.generationId))) throw new ArtifactSafetyError('Unavailable: invalid artifact generation identity.');
  if (value.publishedAt !== undefined && value.publishedAt !== null && (typeof value.publishedAt !== 'string' || !Number.isFinite(Date.parse(value.publishedAt)))) throw new ArtifactSafetyError('Unavailable: invalid publication metadata.');
}

export function assertArtifactPayload(value: unknown, kind: ArtifactKind) {
  if (!object(value)) throw new ArtifactSafetyError('Unavailable: invalid artifact content.');
  const lists: Record<ArtifactKind, string[]> = {
    api_contract: ['endpoints'], relational_schema: ['tables'], document_schema: ['collections'],
    readme: ['gettingStarted'], adrs: ['adrs'], env_vars: ['vars'], deployment: ['components', 'environments', 'cicdSteps'],
    critique: ['findings'], requirements: ['findings'], traceability: ['links'],
  };
  if (!lists[kind].every((key) => Array.isArray(value[key])) || kind === 'readme' && typeof value.overview !== 'string') {
    throw new ArtifactSafetyError('Unavailable: incomplete artifact content.');
  }
}

export function artifactStatus(error: unknown): 'stale' | 'missing' | 'unavailable' {
  const e = error as { code?: string; status?: number; body?: { error?: string } } | null;
  return e?.code === 'artifact_stale' || e?.body?.error === 'artifact_stale' ? 'stale' : e?.status === 404 ? 'missing' : 'unavailable';
}
export function artifactErrorProvenance(error: unknown): { sourceRevision?: number | null; reason?: string } {
  if (!object(error) || !object(error.body)) return {};
  const details = object(error.body.details) ? error.body.details : error.body;
  const metadata = object(details.metadata) ? details.metadata : details;
  const reason = object(metadata.freshness) ? metadata.freshness.reason : metadata.reason;
  return {
    ...(metadata.sourceRevision === null || positive(metadata.sourceRevision) ? { sourceRevision: metadata.sourceRevision } : {}),
    ...(typeof reason === 'string' && reasons.includes(reason) ? { reason } : {}),
  };
}
export function sameArtifact(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameArtifact(v, b[i]));
  if (!object(a) || !object(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameArtifact(a[key], b[key]));
}

export function safeArtifactFilename(filename: string): string {
  if (!filename || /[\\/\x00-\x1f\x7f]/.test(filename) || filename === '.' || filename === '..') throw new ArtifactSafetyError('The download filename is unsafe.');
  return filename;
}
export function exportExpectation(record: unknown): ArtifactExportExpectation {
  if (!object(record) || typeof record.mapId !== 'string') throw new ArtifactSafetyError('Current provenance is required for this export.');
  assertTrackedArtifact(record, record.mapId);
  return { currentRevision: record.currentRevision, generationId: record.generationId };
}
