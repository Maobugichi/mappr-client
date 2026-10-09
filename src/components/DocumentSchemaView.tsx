'use client';

import { useCallback, useEffect, useState } from 'react';
import { DatabaseIcon, DownloadIcon } from '@phosphor-icons/react';
import type { DocumentCollection, DocumentSchemaRecord } from '@/lib/api';
import { ApiError, getDocumentSchema, getDocumentSchemaScript, runDocumentSchema } from '@/lib/api';
import { downloadTextFile } from '@/lib/markdown-export';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function CollectionCard({ collection }: { collection: DocumentCollection }) {
  return (
    <div className="rounded-lg border border-canvas-grid bg-surface-raised p-4">
      <p className="font-mono text-sm font-semibold text-text">{collection.collectionName}</p>

      <div className="mt-3 flex flex-col gap-1.5">
        {collection.fields.map((field) => (
          <div
            key={field.name}
            className="flex flex-wrap items-center gap-2 border-t border-canvas-grid pt-1.5 font-mono text-[11px] first:border-t-0 first:pt-0"
          >
            <span className="text-text">{field.name === 'id' ? '_id' : field.name}</span>
            <span className="text-text-muted">
              {field.type}
              {field.type === 'enum' && field.enumValues && field.enumValues.length > 0
                ? ` (${field.enumValues.join(', ')})`
                : ''}
            </span>
            {field.required && (
              <span className="rounded border border-canvas-grid px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                Required
              </span>
            )}
            {field.relation && (
              <span className="rounded border border-trace/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-trace">
                {field.relation.kind}
              </span>
            )}
            {field.relation && (
              <span className="text-trace">→ {field.relation.targetEntityId}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DocumentSchemaView({ mapId, productName }: { mapId: string; productName: string }) {
  const [schema, setSchema] = useState<DocumentSchemaRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same convention as RelationalSchemaView — load any previously
  // persisted schema on mount.
  useEffect(() => {
    let cancelled = false;
    getDocumentSchema(mapId)
      .then((existing) => {
        if (cancelled) return;
        setSchema(existing);
      })
      .catch((err) => {
        console.error('Failed to load existing document schema:', err);
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
      const result = await runDocumentSchema(mapId);
      setSchema(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong generating the document schema.');
      }
    } finally {
      setIsRunning(false);
    }
  }, [mapId]);

  const handleDownload = useCallback(async () => {
    if (!schema) return;
    setIsDownloading(true);
    setError(null);
    try {
      const script = await getDocumentSchemaScript(mapId);
      const filename = `${slugify(productName) || 'mappr-export'}-mongo-v${schema.version}.js`;
      downloadTextFile(filename, script, 'application/javascript');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong rendering the script.');
      }
    } finally {
      setIsDownloading(false);
    }
  }, [mapId, schema, productName]);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-canvas-grid bg-canvas p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-base font-semibold text-text">Document Schema</p>
          <p className="mt-1 font-body text-sm text-text-muted">
            {schema
              ? `Generated for v${schema.version} · ${schema.collections.length} collection${schema.collections.length === 1 ? '' : 's'}`
              : 'No schema generated for the current version yet.'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {schema && (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 rounded-full border border-canvas-grid px-4 py-2 font-mono text-xs uppercase tracking-wide text-text-muted shadow-lg transition-colors hover:bg-surface-raised hover:text-text disabled:opacity-60"
            >
              <DownloadIcon size={14} weight="bold" />
              {isDownloading ? 'Rendering…' : '.js'}
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={isRunning || isLoading}
            className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <DatabaseIcon size={14} weight="bold" />
            {isRunning ? 'Generating…' : schema ? 'Regenerate' : 'Generate Schema'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger bg-surface px-4 py-2 font-body text-xs text-danger">
          {error}
        </div>
      )}

      {!isLoading && schema && schema.collections.length === 0 && (
        <p className="font-body text-sm text-text-muted">
          No collections were generated — try regenerating.
        </p>
      )}

      {schema && schema.collections.length > 0 && (
        <div className="flex flex-col gap-3">
          {schema.collections.map((collection) => (
            <CollectionCard key={collection.collectionName} collection={collection} />
          ))}
        </div>
      )}
    </div>
  );
}