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