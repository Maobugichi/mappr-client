'use client';

import { useCallback, useEffect, useState } from 'react';
import { DownloadIcon, GearSixIcon } from '@phosphor-icons/react';
import type { EnvVar, EnvVarSetRecord, MapprSystem } from '@/lib/api';
import { ApiError, getEnvVars, getEnvVarsFile, runEnvVars } from '@/lib/api';
import { downloadTextFile } from '@/lib/markdown-export';

type Section = { key: string; title: string; vars: EnvVar[] };

// Same grouping rule as the backend's envVarsRender.ts, so the cards
// here match the sections in the downloaded file: shared variables (and
// any pointing at a node that no longer exists) under "General", then
// one section per architecture node that has variables.
function groupIntoSections(vars: EnvVar[], nodes: MapprSystem['architecture']['nodes']): Section[] {
  const knownIds = new Set(nodes.map((n) => n.id));
  const sections: Section[] = [];

  const general = vars.filter((v) => v.nodeId === null || !knownIds.has(v.nodeId));
  if (general.length > 0) {
    sections.push({ key: 'general', title: 'General', vars: general });
  }

  for (const node of nodes) {
    const nodeVars = vars.filter((v) => v.nodeId === node.id);
    if (nodeVars.length > 0) {
      sections.push({ key: `node:${node.id}`, title: node.label, vars: nodeVars });
    }
  }

  return sections;
}

function EnvVarRow({ envVar }: { envVar: EnvVar }) {
  return (
    <div className="flex flex-col gap-1 border-t border-canvas-grid pt-2 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-text">{envVar.name}</span>
        <span
          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
            envVar.secret ? 'border-danger/40 text-danger' : 'border-canvas-grid text-text-muted'
          }`}
        >
          {envVar.secret ? 'Secret' : 'Config'}
        </span>
        {!envVar.required && (
          <span className="rounded border border-canvas-grid px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">
            Optional
          </span>
        )}
      </div>

      <p className="font-body text-xs text-text-muted">{envVar.description}</p>

      {envVar.placeholder && (
        <p className="font-mono text-[11px] text-text-muted">
          Example: <span className="text-trace">{envVar.placeholder}</span>
        </p>
      )}
    </div>
  );
}

export function EnvVarsView({
  mapId,
  nodes,
}: {
  mapId: string;
  nodes: MapprSystem['architecture']['nodes'];
}) {
  const [record, setRecord] = useState<EnvVarSetRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same convention as AdrView — load any previously persisted set for
  // the map's CURRENT techStack+architecture hash on mount. A stale set
  // from a since-changed hash is not what this returns (see api.ts's
  // getEnvVars comment).
  useEffect(() => {
    let cancelled = false;
    getEnvVars(mapId)
      .then((existing) => {
        if (cancelled) return;
        setRecord(existing);
      })
      .catch((err) => {
        console.error('Failed to load existing environment variables:', err);
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
      const result = await runEnvVars(mapId);
      setRecord(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong generating the environment variables.');
      }
    } finally {
      setIsRunning(false);
    }
  }, [mapId]);

  const handleDownload = useCallback(async () => {
    if (!record) return;
    setIsDownloading(true);
    setError(null);
    try {
      const file = await getEnvVarsFile(mapId);
      downloadTextFile('.env.example', file, 'text/plain');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong rendering the .env.example file.');
      }
    } finally {
      setIsDownloading(false);
    }
  }, [mapId, record]);

  const sections = record ? groupIntoSections(record.vars, nodes) : [];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-canvas-grid bg-canvas p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-base font-semibold text-text">Environment Variables</p>
          <p className="mt-1 font-body text-sm text-text-muted">
            {record
              ? `${record.vars.length} variable${record.vars.length === 1 ? '' : 's'} identified`
              : 'No variables generated for the current tech stack and architecture yet.'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {record && (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 rounded-full border border-canvas-grid px-4 py-2 font-mono text-xs uppercase tracking-wide text-text-muted shadow-lg transition-colors hover:bg-surface-raised hover:text-text disabled:opacity-60"
            >
              <DownloadIcon size={14} weight="bold" />
              {isDownloading ? 'Rendering…' : '.env.example'}
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={isRunning || isLoading}
            className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <GearSixIcon size={14} weight="bold" />
            {isRunning ? 'Generating…' : record ? 'Regenerate' : 'Generate Variables'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger bg-surface px-4 py-2 font-body text-xs text-danger">
          {error}
        </div>
      )}

      {!isLoading && record && record.vars.length === 0 && (
        <p className="font-body text-sm text-text-muted">
          No environment variables were identified — try regenerating.
        </p>
      )}

      {sections.map((section) => (
        <div key={section.key} className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-wide text-text-muted">{section.title}</p>
          <div className="flex flex-col gap-3 rounded-lg border border-canvas-grid bg-surface-raised p-4">
            {section.vars.map((envVar) => (
              <EnvVarRow key={envVar.name} envVar={envVar} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}