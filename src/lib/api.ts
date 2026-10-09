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
// to other artifacts) is assembled on the backend from data already in+// the map, so there's no type for those here.
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



type ApiErrorBody = {
  error: string;
  message?: string;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? body.error);
    this.status = status;
    this.body = body;
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
async function requestText(path: string, init?: RequestInit): Promise<string> {
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

  return response.text();
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

export async function getArchitectureReview(mapId: string): Promise<ArchitectureReview | null> {
  try {
    return await request<ArchitectureReview>(`/maps/${mapId}/critique`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function runArchitectureReview(mapId: string): Promise<ArchitectureReview> {
  return request<ArchitectureReview>(`/maps/${mapId}/critique`, { method: 'POST' });
}

export function setFindingDismissed(
  mapId: string,
  findingId: string,
  dismissed: boolean
): Promise<ArchitectureReview> {
  return request<ArchitectureReview>(`/maps/${mapId}/critique/findings/${findingId}`, {
    method: 'PATCH',
    body: JSON.stringify({ dismissed }),
  });
}

// Same null-on-404 convention as getArchitectureReview above.
export async function getRequirementsReview(mapId: string): Promise<RequirementsReview | null> {
  try {
    return await request<RequirementsReview>(`/maps/${mapId}/requirements`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function runRequirementsReview(mapId: string): Promise<RequirementsReview> {
  return request<RequirementsReview>(`/maps/${mapId}/requirements`, { method: 'POST' });
}

export function setRequirementDismissed(
  mapId: string,
  findingId: string,
  dismissed: boolean
): Promise<RequirementsReview> {
  return request<RequirementsReview>(`/maps/${mapId}/requirements/findings/${findingId}`, {
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

export async function getTraceability(mapId: string): Promise<TraceabilityReview | null> {
  try {
    return await request<TraceabilityReview>(`/maps/${mapId}/traceability`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function runTraceability(mapId: string): Promise<TraceabilityReview> {
  return request<TraceabilityReview>(`/maps/${mapId}/traceability`, { method: 'POST' });
}

export async function getApiContract(mapId: string): Promise<ApiContract | null> {
  try {
    return await request<ApiContract>(`/maps/${mapId}/api-contract`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function runApiContract(mapId: string): Promise<ApiContract> {
  return request<ApiContract>(`/maps/${mapId}/api-contract`, { method: 'POST' });
}

 

// Same null-on-404 convention as getApiContract above.
export async function getRelationalSchema(mapId: string): Promise<RelationalSchemaRecord | null> {
  try {
    return await request<RelationalSchemaRecord>(`/maps/${mapId}/relational-schema`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function runRelationalSchema(mapId: string): Promise<RelationalSchemaRecord> {
  return request<RelationalSchemaRecord>(`/maps/${mapId}/relational-schema`, { method: 'POST' });
}

// Rendering happens on the backend (see relationalRender.ts) — this
// just fetches the already-rendered text for the chosen dialect.
export function getRelationalSchemaSql(mapId: string, dialect: RelationalDialect): Promise<string> {
  return requestText(`/maps/${mapId}/relational-schema/sql?dialect=${dialect}`);
}

 

// Same null-on-404 convention as getApiContract/getRelationalSchema above.
export async function getDocumentSchema(mapId: string): Promise<DocumentSchemaRecord | null> {
  try {
    return await request<DocumentSchemaRecord>(`/maps/${mapId}/document-schema`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function runDocumentSchema(mapId: string): Promise<DocumentSchemaRecord> {
  return request<DocumentSchemaRecord>(`/maps/${mapId}/document-schema`, { method: 'POST' });
}

// Rendering happens on the backend (see documentRender.ts) — this just
// fetches the already-rendered mongosh script. No dialect param, unlike
// getRelationalSchemaSql — there's only one target here.
export function getDocumentSchemaScript(mapId: string): Promise<string> {
  return requestText(`/maps/${mapId}/document-schema/script`);
}

 

// Same null-on-404 convention as the other three schema features —
// here a 404 means no ADR set exists for the map's CURRENT
// techStack+architecture hash specifically (an older set may still
// exist in storage for a since-changed hash, same as an old version's
// contract/schema would).
export async function getAdrs(mapId: string): Promise<AdrSetRecord | null> {
  try {
    return await request<AdrSetRecord>(`/maps/${mapId}/adrs`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function runAdrs(mapId: string): Promise<AdrSetRecord> {
  return request<AdrSetRecord>(`/maps/${mapId}/adrs`, { method: 'POST' });
}

// Rendering happens on the backend (see adrRender.ts) — this just
// fetches the already-rendered Markdown. No format param — ADRs only
// ever render one way.
export function getAdrsMarkdown(mapId: string): Promise<string> {
  return requestText(`/maps/${mapId}/adrs/markdown`);
}

// Same null-on-404 convention as the other version-tied features.
export async function getReadme(mapId: string): Promise<ReadmeRecord | null> {
  try {
    return await request<ReadmeRecord>(`/maps/${mapId}/readme`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function runReadme(mapId: string): Promise<ReadmeRecord> {
  return request<ReadmeRecord>(`/maps/${mapId}/readme`, { method: 'POST' });
}

// Rendering happens on the backend (see readmeRender.ts) — this fetches
// the FULL assembled README (every section, not just overview/
// gettingStarted), since that's the only place with access to the
// other four artifacts' existence for cross-referencing.
export function getReadmeMarkdown(mapId: string): Promise<string> {
  return requestText(`/maps/${mapId}/readme/markdown`);
}