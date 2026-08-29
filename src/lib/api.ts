const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is not set');
}

// Mirrors backend/src/schema/mapprSystem.ts (the Zod schema) as a plain
// TS type. Duplicated rather than shared, since frontend and backend
// are separate projects with no shared package yet — see the "no
// monorepo tooling until there's real shared code" call made when the
// two apps were scaffolded. The backend already validates this shape
// with Zod before it's ever sent, so the frontend trusts it as typed
// rather than re-validating.
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
  developmentPlan: { phase: number; title: string; items: string[] }[];
};

export type MapRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  data: MapprSystem;
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
    credentials: 'include', // required so the anon session cookie round-trips
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