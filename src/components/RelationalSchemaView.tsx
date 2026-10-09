'use client';

import { useCallback, useEffect, useState } from 'react';
import { DatabaseIcon, DownloadIcon } from '@phosphor-icons/react';
import type { RelationalDialect, RelationalSchemaRecord, RelationalTable } from '@/lib/api';
import { ApiError, getRelationalSchema, getRelationalSchemaSql, runRelationalSchema } from '@/lib/api';
import { downloadTextFile } from '@/lib/markdown-export';

const DIALECT_LABEL: Record<RelationalDialect, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function TableCard({ table }: { table: RelationalTable }) {
  return (
    <div className="rounded-lg border border-canvas-grid bg-surface-raised p-4">
      <p className="font-mono text-sm font-semibold text-text">{table.tableName}</p>

      <div className="mt-3 flex flex-col gap-1.5">
        {table.columns.map((column) => (
          <div
            key={column.name}
            className="flex flex-wrap items-center gap-2 border-t border-canvas-grid pt-1.5 font-mono text-[11px] first:border-t-0 first:pt-0"
          >
            <span className="text-text">{column.name}</span>
            <span className="text-text-muted">
              {column.type}
              {column.type === 'enum' && column.enumValues && column.enumValues.length > 0
                ? ` (${column.enumValues.join(', ')})`
                : ''}
            </span>
            {column.primaryKey && (
              <span className="rounded border border-signal/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-signal">
                PK
              </span>
            )}
            {!column.nullable && (
              <span className="rounded border border-canvas-grid px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                Not null
              </span>
            )}
            {column.references && (
              <span className="text-trace">
                → {column.references.table}.{column.references.column}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RelationalSchemaView({ mapId, productName }: { mapId: string; productName: string }) {
  const [schema, setSchema] = useState<RelationalSchemaRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialect, setDialect] = useState<RelationalDialect>('postgres');

  // Same convention as ApiContractView — load any previously persisted
  // schema on mount.
  useEffect(() => {
    let cancelled = false;
    getRelationalSchema(mapId)
      .then((existing) => {
        if (cancelled) return;
        setSchema(existing);
      })
      .catch((err) => {
        console.error('Failed to load existing relational schema:', err);
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
      const result = await runRelationalSchema(mapId);
      setSchema(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong generating the database schema.');
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
      const sql = await getRelationalSchemaSql(mapId, dialect);
      const filename = `${slugify(productName) || 'mappr-export'}-${dialect}-v${schema.version}.sql`;
      downloadTextFile(filename, sql, 'application/sql');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong rendering the SQL.');
      }
    } finally {
      setIsDownloading(false);
    }
  }, [mapId, dialect, schema, productName]);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-canvas-grid bg-canvas p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-base font-semibold text-text">Database Schema</p>
          <p className="mt-1 font-body text-sm text-text-muted">
            {schema
              ? `Generated for v${schema.version} · ${schema.tables.length} table${schema.tables.length === 1 ? '' : 's'}`
              : 'No schema generated for the current version yet.'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {schema && (
            <>
              <select
                value={dialect}
                onChange={(e) => setDialect(e.target.value as RelationalDialect)}
                className="rounded-full border border-canvas-grid bg-surface-raised px-3 py-2 font-mono text-xs uppercase tracking-wide text-text"
              >
                {Object.entries(DIALECT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 rounded-full border border-canvas-grid px-4 py-2 font-mono text-xs uppercase tracking-wide text-text-muted shadow-lg transition-colors hover:bg-surface-raised hover:text-text disabled:opacity-60"
              >
                <DownloadIcon size={14} weight="bold" />
                {isDownloading ? 'Rendering…' : '.sql'}
              </button>
            </>
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

      {!isLoading && schema && schema.tables.length === 0 && (
        <p className="font-body text-sm text-text-muted">
          No tables were generated — try regenerating.
        </p>
      )}

      {schema && schema.tables.length > 0 && (
        <div className="flex flex-col gap-3">
          {schema.tables.map((table) => (
            <TableCard key={table.tableName} table={table} />
          ))}
        </div>
      )}
    </div>
  );
}