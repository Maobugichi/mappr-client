import type { ApiContract, ApiEndpoint, ContractField, ContractFieldType } from './api';



type JsonSchema = Record<string, unknown>;

function fieldTypeToSchema(type: ContractFieldType): JsonSchema {
  switch (type) {
    case 'uuid':
      return { type: 'string', format: 'uuid' };
    case 'datetime':
      return { type: 'string', format: 'date-time' };
    case 'array':
      // No item-level detail is generated for array fields (kept out of
      // the contract schema to keep AI output small) — `items` is left
      // unconstrained rather than guessed.
      return { type: 'array', items: {} };
    default:
      return { type };
  }
}

function fieldsToObjectSchema(fields: ContractField[]): JsonSchema {
  const required = fields.filter((f) => f.required).map((f) => f.name);
  const properties: Record<string, JsonSchema> = {};
  for (const field of fields) {
    properties[field.name] = fieldTypeToSchema(field.type);
  }
  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

// Path parameters are written inline in `path` as {name} (see the
// schema's own buildPrompt rule) — derived here rather than stored
// separately on the endpoint.
function pathParameters(path: string): JsonSchema[] {
  const names = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  return names.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

function queryParameters(queryParams: ContractField[]): JsonSchema[] {
  return queryParams.map((field) => ({
    name: field.name,
    in: 'query',
    required: field.required,
    schema: fieldTypeToSchema(field.type),
  }));
}

function buildOperation(endpoint: ApiEndpoint): JsonSchema {
  const parameters = [...pathParameters(endpoint.path), ...queryParameters(endpoint.queryParams)];

  const responses: Record<string, JsonSchema> = {
    [String(endpoint.successStatus)]: {
      description: endpoint.summary,
      ...(endpoint.responseFields.length > 0
        ? { content: { 'application/json': { schema: fieldsToObjectSchema(endpoint.responseFields) } } }
        : {}),
    },
  };
  for (const err of endpoint.errors) {
    responses[String(err.status)] = { description: err.description };
  }

  return {
    operationId: endpoint.id,
    summary: endpoint.summary,
    // Feature ids double as tags — they're already short, kebab-case
    // slugs (see MapprSystem['features'][number].id), which groups
    // endpoints sensibly in tools like Swagger UI without needing a
    // separate feature-name lookup passed in.
    ...(endpoint.featureIds.length > 0 ? { tags: endpoint.featureIds } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(endpoint.bodyFields.length > 0
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: fieldsToObjectSchema(endpoint.bodyFields) } },
          },
        }
      : {}),
    responses,
    ...(endpoint.access === 'authenticated' ? { security: [{ bearerAuth: [] }] } : {}),
  };
}

export function buildOpenApiDocument(contract: ApiContract, productName: string): JsonSchema {
  const paths: Record<string, Record<string, JsonSchema>> = {};

  for (const endpoint of contract.endpoints) {
    const methodKey = endpoint.method.toLowerCase();
    paths[endpoint.path] = {
      ...paths[endpoint.path],
      [methodKey]: buildOperation(endpoint),
    };
  }

  const hasAuthenticatedEndpoint = contract.endpoints.some((e) => e.access === 'authenticated');

  return {
    openapi: '3.1.0',
    info: {
      title: productName,
      version: String(contract.version),
    },
    paths,
    ...(hasAuthenticatedEndpoint
      ? {
          components: {
            securitySchemes: {
              bearerAuth: { type: 'http', scheme: 'bearer' },
            },
          },
        }
      : {}),
  };
}