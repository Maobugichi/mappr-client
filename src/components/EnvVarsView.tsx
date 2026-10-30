'use client';

import { DownloadIcon, GearSixIcon } from '@phosphor-icons/react';
import type { EnvVar, MapprSystem } from '@/lib/api';
import { getEnvVars, getEnvVarsFile, runEnvVars } from '@/lib/api';
import { useGeneratedArtifact } from '@/lib/use-generated-artifact';
import { MotionDisclosure } from './MotionDisclosure';
import styles from './EnvVarsView.module.css';

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

function EnvVarsContent({
  mapId,
  nodes,
}: {
  mapId: string;
  nodes: MapprSystem['architecture']['nodes'];
}) {
  // The API loads the set for the current techStack + architecture hash,
  // independently of map version. Keep that contract authoritative.
  const {
    record, isLoading, isRunning, isDownloading, isWorking, error,
    resultRevision, downloaded, runGeneration, runDownload,
  } = useGeneratedArtifact({
    mapId, load: getEnvVars, generate: runEnvVars,
    loadError: 'Could not load saved environment variables. Reopen this view to retry, or generate new variables.',
    generationError: 'Something went wrong generating the environment variables.',
    exportError: 'Something went wrong rendering the .env.example file.',
  });

  const handleDownload = (trigger: HTMLButtonElement) => {
    if (!record) return;
    return runDownload(trigger, async () => {
      const file = await getEnvVarsFile(mapId);
      return { filename: '.env.example', content: file, mimeType: 'text/plain' };
    });
  };

  const sections = record ? groupIntoSections(record.vars, nodes) : [];

  let statusMessage = 'No variables generated for the current tech stack and architecture yet.';
  if (isLoading) statusMessage = 'Loading saved environment variables…';
  else if (isRunning) statusMessage = record
    ? 'Generating environment variables. The displayed variables remain visible.' : 'Generating environment variables…';
  else if (isDownloading) statusMessage = 'Preparing .env.example download…';
  else if (record) statusMessage = `${downloaded ? '.env.example download prepared. ' : ''}${record.vars.length} variable${record.vars.length === 1 ? '' : 's'} identified`;
  else if (error) statusMessage = 'No environment variables are currently displayed.';

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-canvas-grid bg-canvas p-6">
      <div>
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-text">Environment Variables</p>
            <p role="status" aria-atomic="true" className="mt-1 font-body text-sm text-text-muted">
              {statusMessage}
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 lg:w-auto">
            {record && (
              <button
                onClick={(event) => void handleDownload(event.currentTarget)}
                disabled={isWorking}
                aria-busy={isDownloading}
                className="flex items-center gap-2 rounded-full border border-canvas-grid px-4 py-2 font-mono text-xs uppercase tracking-wide text-text-muted shadow-lg transition-colors hover:bg-surface-raised hover:text-text disabled:opacity-60"
              >
                <DownloadIcon size={14} weight="bold" />
                {isDownloading ? 'Rendering…' : '.env.example'}
              </button>
            )}
            <button
              onClick={(event) => void runGeneration(event.currentTarget)}
              disabled={isWorking || isLoading}
              aria-busy={isRunning}
              className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <GearSixIcon size={14} weight="bold" />
              {isLoading ? 'Loading…' : isRunning ? 'Generating…' : record ? 'Regenerate' : 'Generate Variables'}
            </button>
          </div>
        </div>

        <MotionDisclosure isOpen={Boolean(error)}>
          <div role="alert" className="mt-4 rounded-lg border border-danger bg-surface px-4 py-2 font-body text-xs text-danger">
            {error}
          </div>
        </MotionDisclosure>
      </div>

      {record && (
        <div key={resultRevision} role="region" aria-label="Environment variables" className={`${styles.results} flex flex-col gap-4`}>
          {record.vars.length === 0 && (
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
      )}
    </div>
  );
}

export function EnvVarsView(props: { mapId: string; nodes: MapprSystem['architecture']['nodes'] }) {
  return <EnvVarsContent key={props.mapId} {...props} />;
}
