'use client';

import { useCallback, useEffect, useState } from 'react';
import { CodeIcon, DownloadIcon } from '@phosphor-icons/react';
import type { AccessLevel, ApiContract, ApiEndpoint, ContractField, HttpMethod } from '@/lib/api';
import { ApiError, getApiContract, runApiContract } from '@/lib/api';
import { buildOpenApiDocument } from '@/lib/openapi-export';
import { downloadTextFile } from '@/lib/markdown-export';

// Same family as SEVERITY_DOT in MissingRequirements.tsx / SEVERITY_RING
// in Overview.tsx — a fixed Record over a closed enum, mapped onto the
// design system's existing tokens rather than introducing new colors.
const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: 'text-trace border-trace/40',
  POST: 'text-success border-success/40',
  PUT: 'text-signal border-signal/40',
  PATCH: 'text-signal border-signal/40',
  DELETE: 'text-danger border-danger/40',
};

const ACCESS_LABEL: Record<AccessLevel, string> = {
  public: 'Public',
  authenticated: 'Authenticated',
};

function fieldSummary(fields: ContractField[]): string {
  return fields.map((f) => `${f.name}${f.required ? '' : '?'}: ${f.type}`).join(', ');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function EndpointRow({ endpoint }: { endpoint: ApiEndpoint }) {
  return (
    <div className="rounded-lg border border-canvas-grid bg-surface-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${METHOD_COLOR[endpoint.method]}`}
        >
          {endpoint.method}
        </span>
        <span className="font-mono text-sm text-text">{endpoint.path}</span>
        <span className="ml-auto rounded-full border border-canvas-grid px-2 py-0.5 font-mono text-[10px] text-text-muted">
          {ACCESS_LABEL[endpoint.access]}
        </span>
      </div>

      <p className="mt-2 font-body text-sm text-text-muted">{endpoint.summary}</p>

      {endpoint.featureIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {endpoint.featureIds.map((id) => (
            <span
              key={id}
              className="rounded-full border border-trace/40 px-2 py-0.5 font-mono text-[10px] text-trace"
            >
              {id}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1 border-t border-canvas-grid pt-2 font-mono text-[11px] text-text-muted">
        {endpoint.queryParams.length > 0 && <p>query: {fieldSummary(endpoint.queryParams)}</p>}
        {endpoint.bodyFields.length > 0 && <p>body: {fieldSummary(endpoint.bodyFields)}</p>}
        <p>
          {endpoint.successStatus} response
          {endpoint.responseFields.length > 0 ? `: ${fieldSummary(endpoint.responseFields)}` : ''}
        </p>
        {endpoint.errors.length > 0 && (
          <p>errors: {endpoint.errors.map((e) => `${e.status} ${e.description}`).join(', ')}</p>
        )}
      </div>
    </div>
  );
}

export function ApiContractView({ mapId, productName }: { mapId: string; productName: string }) {
  const [contract, setContract] = useState<ApiContract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load any previously persisted contract on mount — same convention
  // as Overview.tsx for the requirements review and traceability trace.
  useEffect(() => {
    let cancelled = false;
    getApiContract(mapId)
      .then((existing) => {
        if (cancelled) return;
        setContract(existing);
      })
      .catch((err) => {
        console.error('Failed to load existing API contract:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await runApiContract(mapId);
      setContract(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong generating the API contract.');
      }
    } finally {
      setIsRunning(false);
    }
  }, [mapId]);

  const handleDownload = useCallback(() => {
    if (!contract) return;
    const document = buildOpenApiDocument(contract, productName);
    const filename = `${slugify(productName) || 'mappr-export'}-openapi-v${contract.version}.json`;
    downloadTextFile(filename, JSON.stringify(document, null, 2), 'application/json');
  }, [contract, productName]);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-canvas-grid bg-canvas p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-base font-semibold text-text">API Contract</p>
          <p className="mt-1 font-body text-sm text-text-muted">
            {contract
              ? `Generated for v${contract.version} · ${contract.endpoints.length} endpoint${contract.endpoints.length === 1 ? '' : 's'}`
              : 'No contract generated for the current version yet.'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {contract && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-full border border-canvas-grid px-4 py-2 font-mono text-xs uppercase tracking-wide text-text-muted shadow-lg transition-colors hover:bg-surface-raised hover:text-text"
            >
              <DownloadIcon size={14} weight="bold" />
              OpenAPI (.json)
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={isRunning || isLoading}
            className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <CodeIcon size={14} weight="bold" />
            {isRunning ? 'Generating…' : contract ? 'Regenerate' : 'Generate API Contract'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger bg-surface px-4 py-2 font-body text-xs text-danger">
          {error}
        </div>
      )}

      {!isLoading && contract && contract.endpoints.length === 0 && (
        <p className="font-body text-sm text-text-muted">
          No endpoints were generated — try regenerating.
        </p>
      )}

      {contract && contract.endpoints.length > 0 && (
        <div className="flex flex-col gap-3">
          {contract.endpoints.map((endpoint) => (
            <EndpointRow key={endpoint.id} endpoint={endpoint} />
          ))}
        </div>
      )}
    </div>
  );
}