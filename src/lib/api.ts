import { ARTIFACT_ROUTES, assertArtifactPayload, assertTrackedArtifact, ArtifactMutationError, ArtifactSafetyError, type ArtifactKind, type ArtifactExportExpectation } from './artifact-safety';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is not set');
}

export type MapprSystem = {
  meta: { productName: string; oneLineSummary: string };
  product: { summary: string; concepts: string[] };
  users: { id: string; name: string; description: string }[];
  features: {
    id: string;
    name: string;
    description: string;
    relatedUsers: string[];
    dependsOn: string[];
  }[];
  techStack: { category: string; choice: string; rationale: string }[];
  architecture: {
    nodes: { id: string; label: string; type: string; description: string }[];
    edges: { from: string; to: string; label?: string }[];
  };
  dataModel: {
    entities: { id: string; name: string; fields: { name: string; type: string }[] }[];
    relations: {
      from: string;
      to: string;
      type: 'one-to-one' | 'one-to-many' | 'many-to-many';
      label?: string;
    }[];
  };
  designSystem: {
    colors: { token: string; value: string }[];
    typography: { token: string; value: string }[];
    spacing: { token: string; value: string }[];
    components: { name: string; description: string }[];
  };
  developmentPlan: {
    phase: number;
    title: string;
    items: { description: string; relatedFeatures: string[] }[];
  }[];
};

export type MapRecord = {
  id: string;
  // Older saved maps can still be read without an established S3 revision.
  revision?: number;
  createdAt: string;
  updatedAt: string;
  data: MapprSystem;
};

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';

export type FindingCategory =
  | 'architecture'
  | 'security'
  | 'scalability'
  | 'performance'
  | 'reliability'
  | 'maintainability'
  | 'data'
  | 'observability'
  | 'cost'
  | 'developer_experience';

export type FindingObservationType = 'observed' | 'inferred' | 'recommended';

export type ArchitectureFinding = {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  category: FindingCategory;
  observationType: FindingObservationType;
  affectedNodeIds: string[];
  recommendation: string;
  dismissed: boolean;
};

export type ArchitectureReview = {
  mapId: string;
  findings: ArchitectureFinding[];
  createdAt: string;
  updatedAt: string;
};

// Mirrors backend/src/schema/missingRequirement.ts (the Zod schema),
// duplicated for the same reason MapprSystem/ArchitectureFinding are
// above.
export type RequirementCategory =
  | 'auth'
  | 'data_integrity'
  | 'error_handling'
  | 'compliance'
  | 'notifications'
  | 'edge_case'
  | 'non_functional'
  | 'other';

export type MissingRequirement = {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  category: RequirementCategory;
  relatedFeatureIds: string[];
  suggestedFeature: { name: string; description: string };
  dismissed: boolean;
};

export type RequirementsReview = {
  mapId: string;
  findings: MissingRequirement[];
  createdAt: string;
  updatedAt: string;
};

// Mirrors backend/src/schema/architecturePatch.ts (the Zod schema).
export type ArchitecturePatch = {
  addNodes: { id: string; label: string; type: string; description: string }[];
  removeNodeIds: string[];
  updateNodes: { id: string; label?: string; type?: string; description?: string }[];
  addEdges: { from: string; to: string; label?: string }[];
  removeEdges: { from: string; to: string; label?: string }[];
};

export type IterationResult = {
  mapId: string;
  version: number;
  summary: string;
  patch: ArchitecturePatch;
  data: MapprSystem;
};

export type VersionSummary = {
  version: number;
  summary: string;
  createdAt: string;
};

export type ArrayDiff<T> = {
  added: T[];
  removed: T[];
  changed: { before: T; after: T; changedFields: string[] }[];
};

export type SimpleArrayDiff<T> = { added: T[]; removed: T[] };

export type FieldDiff = { field: string; before: unknown; after: unknown };

export type SystemDiff = {
  meta: FieldDiff[];
  product: { summary: FieldDiff[]; concepts: SimpleArrayDiff<string> };
  users: ArrayDiff<MapprSystem['users'][number]>;
  features: ArrayDiff<MapprSystem['features'][number]>;
  techStack: ArrayDiff<MapprSystem['techStack'][number]>;
  architecture: {
    nodes: ArrayDiff<MapprSystem['architecture']['nodes'][number]>;
    edges: SimpleArrayDiff<MapprSystem['architecture']['edges'][number]>;
  };
  dataModel: {
    entities: ArrayDiff<MapprSystem['dataModel']['entities'][number]>;
    relations: SimpleArrayDiff<MapprSystem['dataModel']['relations'][number]>;
  };
  designSystem: {
    colors: ArrayDiff<MapprSystem['designSystem']['colors'][number]>;
    typography: ArrayDiff<MapprSystem['designSystem']['typography'][number]>;
    spacing: ArrayDiff<MapprSystem['designSystem']['spacing'][number]>;
    components: ArrayDiff<MapprSystem['designSystem']['components'][number]>;
  };
  developmentPlan: {
    added: MapprSystem['developmentPlan'][number][];
    removed: MapprSystem['developmentPlan'][number][];
    changed: {
      phase: number;
      titleChanged: boolean;
      items: SimpleArrayDiff<MapprSystem['developmentPlan'][number]['items'][number]>;
    }[];
  };
  hasChanges: boolean;
};

export type DiffResult = {
  mapId: string;
  from: number;
  to: number;
  diff: SystemDiff;
};

export type TraceLink = {
  featureId: string;
  nodeIds: string[];
  note?: string;
};

export type TraceabilityReview = {
  mapId: string;
  links: TraceLink[];
  createdAt: string;
  updatedAt: string;
};

export type ContractFieldType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'uuid'
  | 'datetime'
  | 'array'
  | 'object';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AccessLevel = 'public' | 'authenticated';

export type ContractField = { name: string; type: ContractFieldType; required: boolean };

export type ContractError = { status: number; description: string };

export type ApiEndpoint = {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  featureIds: string[];
  entityIds: string[];
  access: AccessLevel;
  queryParams: ContractField[];
  bodyFields: ContractField[];
  successStatus: number;
  responseFields: ContractField[];
  errors: ContractError[];
};

export type ApiContract = {
  mapId: string;
  version: number;
  endpoints: ApiEndpoint[];
  createdAt: string;
  updatedAt: string;
};

// Mirrors backend/src/schema/relationalSchema.ts (the Zod schema).
export type LogicalType =
  | 'uuid'
  | 'string'
  | 'text'
  | 'integer'
  | 'bigint'
  | 'decimal'
  | 'boolean'
  | 'datetime'
  | 'date'
  | 'json'
  | 'enum';

export type RelationalDialect = 'postgres' | 'mysql' | 'sqlite';

export type ColumnReference = { table: string; column: string };

export type RelationalColumn = {
  name: string;
  type: LogicalType;
  nullable: boolean;
  primaryKey: boolean;
  references: ColumnReference | null;
  enumValues: string[] | null;
};

export type RelationalTable = {
  entityId: string;
  tableName: string;
  columns: RelationalColumn[];
};

export type RelationalSchemaRecord = {
  mapId: string;
  version: number;
  tables: RelationalTable[];
  createdAt: string;
  updatedAt: string;
};



export type DocumentLogicalType =
  | 'objectId'
  | 'string'
  | 'integer'
  | 'bigint'
  | 'decimal'
  | 'boolean'
  | 'datetime'
  | 'date'
  | 'object'
  | 'array'
  | 'enum';

export type RelationKind = 'embed' | 'reference';

export type FieldRelation = { kind: RelationKind; targetEntityId: string };

export type DocumentField = {
  name: string;
  type: DocumentLogicalType;
  required: boolean;
  enumValues: string[] | null;
  relation: FieldRelation | null;
};

export type DocumentCollection = {
  entityId: string;
  collectionName: string;
  fields: DocumentField[];
};

export type DocumentSchemaRecord = {
  mapId: string;
  version: number;
  collections: DocumentCollection[];
  createdAt: string;
  updatedAt: string;
};


// Mirrors backend/src/schema/adr.ts (the Zod schema).
export type AdrSubjectType = 'tech_stack' | 'architecture_node' | 'architecture_edge';

export type AdrAlternative = { option: string; reasonRejected: string };

export type Adr = {
  subjectType: AdrSubjectType;
  subjectId: string;
  title: string;
  context: string;
  decision: string;
  alternatives: AdrAlternative[];
  consequences: string[];
};

// Keyed by techArchHash, not a map version — see the backend route's
// own comment on why ADRs persist across dataModel/feature-only edits.
export type AdrSetRecord = {
  mapId: string;
  techArchHash: string;
  adrs: Adr[];
  createdAt: string;
  updatedAt: string;
};

// Mirrors backend/src/schema/readme.ts (the Zod schema). Only these two
// fields are AI-generated and stored — everything else in the rendered
// README (Features, Tech Stack, Architecture, Roadmap, cross-references
// to other artifacts) is assembled on the backend from data already in// the map, so there's no type for those here.
export type GettingStartedStep = { description: string; command: string | null };

export type ReadmeRecord = {
  mapId: string;
  version: number;
  overview: string;
  gettingStarted: GettingStartedStep[];
  createdAt: string;
  updatedAt: string;
};

// Mirrors backend/src/schema/envVars.ts (the Zod schema).
export type EnvVar = {
  name: string;
  description: string;
  required: boolean;
  secret: boolean;
  placeholder: string;
  nodeId: string | null;
  techStackCategory: string | null;
};

// Keyed by techArchHash, not a map version — same as AdrSetRecord, and
// for the same reason: adding a feature or editing the data model
// doesn't change which environment variables a system needs.
export type EnvVarSetRecord = {
  mapId: string;
  techArchHash: string;
  vars: EnvVar[];
  createdAt: string;
  updatedAt: string;
};


// Mirrors backend/src/schema/deployment.ts (the Zod schema).
export type DeploymentComponentKind =
  | 'application'
  | 'managed_resource'
  | 'external_service'
  | 'embedded';

export type DeploymentExposure = 'public' | 'internal';

// null on a component for an external service or embedded component,
// where scaling/health/backup have no real answer.
export type DeploymentOperations = {
  exposure: DeploymentExposure;
  scaling: string;
  healthCheck: string;
  // null for a stateless component.
  backup: string | null;
};

export type DeploymentComponent = {
  nodeId: string;
  kind: DeploymentComponentKind;
  platform: string;
  steps: string[];
  verify: string;
  rollback: string | null;
  operations: DeploymentOperations | null;
  hostNodeId: string | null;
};

export type DeploymentEnvironment = { name: string; purpose: string };

// Keyed by techArchHash, not a map version — same as AdrSetRecord and
// EnvVarSetRecord, and for the same reason: where components run
// depends on techStack  architecture only.
export type DeploymentRecord = {
  mapId: string;
  techArchHash: string;
  components: DeploymentComponent[];
  environments: DeploymentEnvironment[];
  cicdSteps: string[];
  // How and when database migrations are applied; null if there's no database.
  migrations: string | null;
  createdAt: string;
  updatedAt: string;
};

 
type ApiErrorBody = {
  error: string;
  message?: string;
  details?: unknown;
  requestId?: string;
  retry?: 'same_request' | 'new_preview' | 'refresh_map' | 'none';
};

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;
  retryAfterMs: number;

  constructor(status: number, body: ApiErrorBody, retryAfterMs = 0) {
    super(body.message ?? body.error);
    this.status = status;
    this.body = body;
    this.retryAfterMs = retryAfterMs;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => ({ error: 'unknown_error' }))) as ApiErrorBody;
    throw new ApiError(response.status, body);
  }

  return response.json() as Promise<T>;
}


// Same error handling as request(), but for an endpoint that returns
// plain text on success rather than JSON — used only by
// getRelationalSchemaSql, since calling response.json() on real SQL
// text would throw.
async function requestText(path: string, init?: RequestInit, expected?: ArtifactExportExpectation): Promise<string> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => ({ error: 'unknown_error' }))) as ApiErrorBody;
    throw new ApiError(response.status, body);
  }

  const type = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  const route = path.split('?')[0];
  const allowed = route.endsWith('/sql') ? ['application/sql', 'text/x-sql', 'text/plain']
    : route.endsWith('/script') ? ['application/javascript', 'text/javascript', 'text/plain']
    : route.endsWith('/markdown') ? ['text/markdown', 'text/plain'] : ['text/plain'];
  if (!type || !allowed.includes(type)) throw new ArtifactSafetyError('The export returned an unexpected content type. No file was downloaded.');
  const revision = response.headers.get('X-Mappr-Current-Revision');
  if (revision !== null && (!/^\d+$/.test(revision) || Number(revision) < 1)) throw new ArtifactSafetyError('Invalid export snapshot metadata.');
  const generation = response.headers.get('X-Mappr-Artifact-Generation');
  const render = response.headers.get('X-Mappr-Render-Fingerprint');
  if (generation !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(generation)) throw new ArtifactSafetyError('Invalid export generation metadata.');
  if (expected && revision !== null && Number(revision) !== expected.currentRevision
    || expected?.generationId && generation !== null && generation !== expected.generationId
    || render !== null && !render.trim()) throw new ArtifactSafetyError('The export snapshot changed. Refresh before downloading.');
  const content = await response.text();
  if (/^\s*(?:<!doctype\s+html|<html[\s>])/i.test(content)) throw new ArtifactSafetyError('The export returned an HTML document. No file was downloaded.');
  try {
    const json = JSON.parse(content);
    if (json && typeof json === 'object' && ('error' in json || 'message' in json)) throw new ArtifactSafetyError('The export returned an error document. No file was downloaded.');
  } catch (error) { if (error instanceof ArtifactSafetyError) throw error; }
  return content;
}

async function trackedArtifact<T>(mapId: string, kind: ArtifactKind, inspection = false): Promise<T | null> {
  try {
    // Always construct the known route. Never follow an untrusted inspectionUrl.
    const record = await request<T>(`/maps/${mapId}/${ARTIFACT_ROUTES[kind]}?freshness=tracked${inspection ? '&includeStale=true' : ''}`, { cache: 'no-store' });
    assertTrackedArtifact(record, mapId, inspection ? 'inspection' : 'current');
    assertArtifactPayload(record, kind);
    return record;
  } catch (error) {
    if (!inspection && error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

async function mutateArtifact<T>(mapId: string, kind: ArtifactKind, suffix = '', init: RequestInit = { method: 'POST' }): Promise<T> {
  let mutationError: unknown;
  try { await request(`/maps/${mapId}/${ARTIFACT_ROUTES[kind]}${suffix}`, { ...init, cache: 'no-store' }); }
  catch (error) { mutationError = error; }
  let current: T | null;
  try { current = await trackedArtifact<T>(mapId, kind); }
  catch (error) {
    if (mutationError) throw new ArtifactMutationError(mutationError, null, error);
    throw error;
  }
  if (mutationError) throw new ArtifactMutationError(mutationError, current);
  if (!current) throw new ArtifactSafetyError('The request completed, but no tracked current artifact is available. Refresh before retrying generation.');
  return current;
}

export function generateMap(description: string): Promise<MapRecord> {
  return request<MapRecord>('/generate', {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
}

export function getMap(id: string): Promise<MapRecord> {
  return request<MapRecord>(`/maps/${id}`);
}

export type ChangeHttpResult<T> = { data: T; serverTime: number | null };

// Browser-only pilot requests: no session fabrication, Origin override, or
// fallback to iteration. The backend release interlock remains authoritative.
async function changeRequest<T>(path: string, init?: RequestInit, expectedStatus?: number): Promise<ChangeHttpResult<T>> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init, credentials: 'include', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const date = Date.parse(response.headers.get('Date') ?? '');
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'unknown_error' })) as ApiErrorBody;
    const retry = response.headers.get('Retry-After');
    const delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000
      : Math.max(0, Date.parse(retry ?? '') - (Number.isFinite(date) ? date : Date.now()));
    throw new ApiError(response.status, body, Number.isFinite(delay) ? delay : 0);
  }
  if (expectedStatus !== undefined && response.status !== expectedStatus) throw new Error(`Unexpected change response status: ${response.status}.`);
  return { data: await response.json() as T, serverTime: Number.isFinite(date) ? date : null };
}

export function getEditEligibility(mapId: string) {
  return changeRequest<{ mapId: string; canEdit: true }>(`/maps/${mapId}/edit-eligibility`);
}
export async function inspectSavedArtifact<T>(mapId: string, load: (mapId: string, inspection?: boolean) => Promise<T | null>) {
  const owner = await getEditEligibility(mapId);
  if (owner.data?.mapId !== mapId || owner.data.canEdit !== true) throw new ArtifactSafetyError('Only the established owner session can inspect saved output.');
  return load(mapId, true);
}

export function getChangeMap(mapId: string) {
  return changeRequest<MapRecord>(`/maps/${mapId}`);
}

export function previewOverviewChange(mapId: string, body: import('./overview-change-contract').OverviewChangeRequest, key: string) {
  return changeRequest<import('./overview-change-contract').OverviewProposal>(`/maps/${mapId}/changes/preview`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body),
  });
}

export function applyOverviewChange(mapId: string, proposalId: string, baseRevision: number) {
  return changeRequest<import('./overview-change-contract').OverviewApplyReceipt>(`/maps/${mapId}/changes/${proposalId}/apply`, {
    method: 'POST', body: JSON.stringify({ approved: true, expectedBaseRevision: baseRevision }),
  });
}
export function previewArchitectureChange(mapId: string, body: import('./architecture-change-contract').ArchitectureChangeRequest, key: string) {
  return changeRequest<import('./architecture-change-contract').ArchitectureProposal>(`/maps/${mapId}/changes/preview`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body),
  });
}
export function applyChangeProposal(mapId: string, proposalId: string, baseRevision: number) {
  return changeRequest<import('./change-protocol').ChangeReceipt>(`/maps/${mapId}/changes/${proposalId}/apply`, {
    method: 'POST', body: JSON.stringify({ approved: true, expectedBaseRevision: baseRevision }),
  });
}
export function rejectChangeProposal(mapId: string, proposalId: string, baseRevision: number) {
  return changeRequest<import('./change-protocol').ChangeRejection>(`/maps/${mapId}/changes/${proposalId}/reject`, {
    method: 'POST', body: JSON.stringify({ rejected: true, expectedBaseRevision: baseRevision }),
  }, 200);
}
export const applyArchitectureChange = applyChangeProposal;
export const rejectArchitectureChange = rejectChangeProposal;

export function previewTechStackChange(mapId: string, body: import('./tech-stack-change-contract').TechStackChangeRequest, key: string) {
  return changeRequest<import('./tech-stack-change-contract').TechStackProposal>(`/maps/${mapId}/changes/preview`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body),
  });
}

export async function getArchitectureReview(mapId: string, inspection = false): Promise<ArchitectureReview | null> {
  return trackedArtifact<ArchitectureReview>(mapId, 'critique', inspection);
}

export function runArchitectureReview(mapId: string): Promise<ArchitectureReview> {
  return mutateArtifact<ArchitectureReview>(mapId, 'critique');
}

export function setFindingDismissed(
  mapId: string,
  findingId: string,
  dismissed: boolean
): Promise<ArchitectureReview> {
  return mutateArtifact<ArchitectureReview>(mapId, 'critique', `/findings/${findingId}`, {
    method: 'PATCH',
    body: JSON.stringify({ dismissed }),
  });
}

// Same null-on-404 convention as getArchitectureReview above.
export async function getRequirementsReview(mapId: string, inspection = false): Promise<RequirementsReview | null> {
  return trackedArtifact<RequirementsReview>(mapId, 'requirements', inspection);
}

export function runRequirementsReview(mapId: string): Promise<RequirementsReview> {
  return mutateArtifact<RequirementsReview>(mapId, 'requirements');
}

export function setRequirementDismissed(
  mapId: string,
  findingId: string,
  dismissed: boolean
): Promise<RequirementsReview> {
  return mutateArtifact<RequirementsReview>(mapId, 'requirements', `/findings/${findingId}`, {
    method: 'PATCH',
    body: JSON.stringify({ dismissed }),
  });
}

export function runIteration(mapId: string, instruction: string): Promise<IterationResult> {
  return request<IterationResult>(`/maps/${mapId}/iterate`, {
    method: 'POST',
    body: JSON.stringify({ instruction }),
  });
}

export function getVersions(mapId: string): Promise<VersionSummary[]> {
  return request<VersionSummary[]>(`/maps/${mapId}/versions`);
}

export function getDiff(mapId: string, from: number, to: number): Promise<DiffResult> {
  return request<DiffResult>(`/maps/${mapId}/diff?from=${from}&to=${to}`);
}

export async function getTraceability(mapId: string, inspection = false): Promise<TraceabilityReview | null> {
  return trackedArtifact<TraceabilityReview>(mapId, 'traceability', inspection);
}

export function runTraceability(mapId: string): Promise<TraceabilityReview> {
  return mutateArtifact<TraceabilityReview>(mapId, 'traceability');
}

export async function getApiContract(mapId: string, inspection = false): Promise<ApiContract | null> {
  return trackedArtifact<ApiContract>(mapId, 'api_contract', inspection);
}

export function runApiContract(mapId: string): Promise<ApiContract> {
  return mutateArtifact<ApiContract>(mapId, 'api_contract');
}

 

// Same null-on-404 convention as getApiContract above.
export async function getRelationalSchema(mapId: string, inspection = false): Promise<RelationalSchemaRecord | null> {
  return trackedArtifact<RelationalSchemaRecord>(mapId, 'relational_schema', inspection);
}

export function runRelationalSchema(mapId: string): Promise<RelationalSchemaRecord> {
  return mutateArtifact<RelationalSchemaRecord>(mapId, 'relational_schema');
}

// Rendering happens on the backend (see relationalRender.ts) — this
// just fetches the already-rendered text for the chosen dialect.
export function getRelationalSchemaSql(mapId: string, dialect: RelationalDialect, expected?: ArtifactExportExpectation): Promise<string> {
  if (!['postgres', 'mysql', 'sqlite'].includes(dialect)) throw new ArtifactSafetyError('Unsupported SQL export dialect.');
  return requestText(`/maps/${mapId}/relational-schema/sql?dialect=${dialect}`, undefined, expected);
}

 

// Same null-on-404 convention as getApiContract/getRelationalSchema above.
export async function getDocumentSchema(mapId: string, inspection = false): Promise<DocumentSchemaRecord | null> {
  return trackedArtifact<DocumentSchemaRecord>(mapId, 'document_schema', inspection);
}

export function runDocumentSchema(mapId: string): Promise<DocumentSchemaRecord> {
  return mutateArtifact<DocumentSchemaRecord>(mapId, 'document_schema');
}

// Rendering happens on the backend (see documentRender.ts) — this just
// fetches the already-rendered mongosh script. No dialect param, unlike
// getRelationalSchemaSql — there's only one target here.
export function getDocumentSchemaScript(mapId: string, expected?: ArtifactExportExpectation): Promise<string> {
  return requestText(`/maps/${mapId}/document-schema/script`, undefined, expected);
}

 

// Same null-on-404 convention as the other three schema features —
// here a 404 means no ADR set exists for the map's CURRENT
// techStackarchitecture hash specifically (an older set may still
// exist in storage for a since-changed hash, same as an old version's
// contract/schema would).
export async function getAdrs(mapId: string, inspection = false): Promise<AdrSetRecord | null> {
  return trackedArtifact<AdrSetRecord>(mapId, 'adrs', inspection);
}

export function runAdrs(mapId: string): Promise<AdrSetRecord> {
  return mutateArtifact<AdrSetRecord>(mapId, 'adrs');
}

// Rendering happens on the backend (see adrRender.ts) — this just
// fetches the already-rendered Markdown. No format param — ADRs only
// ever render one way.
export function getAdrsMarkdown(mapId: string, expected?: ArtifactExportExpectation): Promise<string> {
  return requestText(`/maps/${mapId}/adrs/markdown`, undefined, expected);
}

// Same null-on-404 convention as the other version-tied features.
export async function getReadme(mapId: string, inspection = false): Promise<ReadmeRecord | null> {
  return trackedArtifact<ReadmeRecord>(mapId, 'readme', inspection);
}

export function runReadme(mapId: string): Promise<ReadmeRecord> {
  return mutateArtifact<ReadmeRecord>(mapId, 'readme');
}

// Rendering happens on the backend (see readmeRender.ts) — this fetches
// the FULL assembled README (every section, not just overview/
// gettingStarted), since that's the only place with access to the
// other four artifacts' existence for cross-referencing.
export function getReadmeMarkdown(mapId: string, expected?: ArtifactExportExpectation): Promise<string> {
  return requestText(`/maps/${mapId}/readme/markdown`, undefined, expected);
}

 

// Same null-on-404 convention as getAdrs — a 404 means no variable set
// exists for the map's CURRENT techStackarchitecture hash (an older
// set may still be in storage for a since-changed hash).
export async function getEnvVars(mapId: string, inspection = false): Promise<EnvVarSetRecord | null> {
  return trackedArtifact<EnvVarSetRecord>(mapId, 'env_vars', inspection);
}

export function runEnvVars(mapId: string): Promise<EnvVarSetRecord> {
  return mutateArtifact<EnvVarSetRecord>(mapId, 'env_vars');
}

 export function getEnvVarsFile(mapId: string, expected?: ArtifactExportExpectation): Promise<string> {
   return requestText(`/maps/${mapId}/env-vars/file`, undefined, expected);
 }

// Same null-on-404 convention as getAdrs/getEnvVars — a 404 means no plan
// exists for the map's CURRENT techStackarchitecture hash (an older one
// may still be in storage for a since-changed hash).
export async function getDeployment(mapId: string, inspection = false): Promise<DeploymentRecord | null> {
  return trackedArtifact<DeploymentRecord>(mapId, 'deployment', inspection);
}

export function runDeployment(mapId: string): Promise<DeploymentRecord> {
  return mutateArtifact<DeploymentRecord>(mapId, 'deployment');
}

// Rendering happens on the backend (see deploymentRender.ts) — this
// fetches the finished plan as Markdown. It lives there because it needs
// the live architecture to list connections and any uncovered nodes, and
// keeping it in one place means the screen and the download can't drift.
export function getDeploymentMarkdown(mapId: string, expected?: ArtifactExportExpectation): Promise<string> {
  return requestText(`/maps/${mapId}/deployment/markdown`, undefined, expected);
}
