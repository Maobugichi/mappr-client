'use client';

import { BookOpenTextIcon, DownloadIcon } from '@phosphor-icons/react';
import type { Adr } from '@/lib/api';
import { getAdrs, getAdrsMarkdown, runAdrs } from '@/lib/api';
import { useGeneratedArtifact } from '@/lib/use-generated-artifact';
import { MotionDisclosure } from './MotionDisclosure';
import styles from './AdrView.module.css';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function AdrCard({ adr }: { adr: Adr }) {
  return (
    <div className={`${styles.card} rounded-lg border border-canvas-grid bg-surface-raised p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display text-sm font-semibold text-text">{adr.title}</p>
        <span className="rounded-full border border-success/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-success">
          Accepted
        </span>
        <span className="ml-auto rounded border border-canvas-grid px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
          {adr.subjectId}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2 font-body text-sm text-text-muted">
        <p>{adr.context}</p>
        <p className="text-text">{adr.decision}</p>
      </div>

      {adr.alternatives.length > 0 && (
        <div className="mt-3 border-t border-canvas-grid pt-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">Alternatives considered</p>
          <ul className="mt-1 flex flex-col gap-1">
            {adr.alternatives.map((alt) => (
              <li key={alt.option} className="font-body text-xs text-text-muted">
                <span className="text-text">{alt.option}</span> — {alt.reasonRejected}
              </li>
            ))}
          </ul>
        </div>
      )}

      {adr.consequences.length > 0 && (
        <div className="mt-3 border-t border-canvas-grid pt-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">Consequences</p>
          <ul className="mt-1 flex flex-col gap-1">
            {adr.consequences.map((consequence) => (
              <li key={consequence} className="font-body text-xs text-text-muted">
                {consequence}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AdrContent({ mapId, productName }: { mapId: string; productName: string }) {
  // The API loads ADRs for the current techStack + architecture hash,
  // independently of map version. Keep that contract authoritative.
  const {
    record, isLoading, isRunning, isDownloading, isWorking, error,
    resultRevision, downloaded, runGeneration, runDownload,
  } = useGeneratedArtifact({
    mapId, load: getAdrs, generate: runAdrs,
    loadError: 'Could not load saved ADRs. Reopen this view to retry, or generate new ADRs.',
    generationError: 'Something went wrong generating the ADRs.',
    exportError: 'Something went wrong rendering the Markdown.',
  });

  const handleDownload = (trigger: HTMLButtonElement) => {
    if (!record) return;
    return runDownload(trigger, async () => {
      const markdown = await getAdrsMarkdown(mapId);
      return {
        filename: `${slugify(productName) || 'mappr-export'}-adrs.md`,
        content: markdown, mimeType: 'text/markdown',
      };
    });
  };

  const techStackAdrs = record?.adrs.filter((a) => a.subjectType === 'tech_stack') ?? [];
  const architectureAdrs = record?.adrs.filter((a) => a.subjectType !== 'tech_stack') ?? [];

  let statusMessage = 'No ADRs generated for the current tech stack and architecture yet.';
  if (isLoading) statusMessage = 'Loading saved ADRs…';
  else if (isRunning) statusMessage = record
    ? 'Generating decision records. The displayed decisions remain visible.' : 'Generating decision records…';
  else if (isDownloading) statusMessage = 'Preparing Markdown download…';
  else if (record) statusMessage = `${downloaded ? 'Markdown download prepared. ' : ''}${record.adrs.length} decision${record.adrs.length === 1 ? '' : 's'} recorded`;
  else if (error) statusMessage = 'No ADRs are currently displayed.';

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-canvas-grid bg-canvas p-6">
      <div>
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-text">Architecture Decision Records</p>
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
                {isDownloading ? 'Rendering…' : '.md'}
              </button>
            )}
            <button
              onClick={(event) => void runGeneration(event.currentTarget)}
              disabled={isWorking || isLoading}
              aria-busy={isRunning}
              className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <BookOpenTextIcon size={14} weight="bold" />
              {isLoading ? 'Loading…' : isRunning ? 'Generating…' : record ? 'Regenerate' : 'Generate ADRs'}
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
        <div key={resultRevision} role="region" aria-label="Decision records" className={`${styles.results} flex flex-col gap-4`}>
          {record.adrs.length === 0 && (
            <p className="font-body text-sm text-text-muted">
              No notable decisions were found to record — try regenerating.
            </p>
          )}

          {techStackAdrs.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="font-mono text-xs uppercase tracking-wide text-text-muted">Tech Stack Decisions</p>
              {techStackAdrs.map((adr) => (
                <AdrCard key={`${adr.subjectType}:${adr.subjectId}`} adr={adr} />
              ))}
            </div>
          )}

          {architectureAdrs.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="font-mono text-xs uppercase tracking-wide text-text-muted">Architecture Decisions</p>
              {architectureAdrs.map((adr) => (
                <AdrCard key={`${adr.subjectType}:${adr.subjectId}`} adr={adr} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AdrView(props: { mapId: string; productName: string }) {
  return <AdrContent key={props.mapId} {...props} />;
}
