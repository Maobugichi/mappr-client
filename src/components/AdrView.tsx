'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpenTextIcon, DownloadIcon } from '@phosphor-icons/react';
import type { Adr, AdrSetRecord } from '@/lib/api';
import { ApiError, getAdrs, getAdrsMarkdown, runAdrs } from '@/lib/api';
import { downloadTextFile } from '@/lib/markdown-export';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function AdrCard({ adr }: { adr: Adr }) {
  return (
    <div className="rounded-lg border border-canvas-grid bg-surface-raised p-4">
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

export function AdrView({ mapId, productName }: { mapId: string; productName: string }) {
  const [record, setRecord] = useState<AdrSetRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same convention as the other schema views — load any previously
  // persisted ADRs for the map's CURRENT techStack+architecture hash on
  // mount. A stale set from a since-changed hash is not what this
  // returns (see api.ts's getAdrs comment).
  useEffect(() => {
    let cancelled = false;
    getAdrs(mapId)
      .then((existing) => {
        if (cancelled) return;
        setRecord(existing);
      })
      .catch((err) => {
        console.error('Failed to load existing ADRs:', err);
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
      const result = await runAdrs(mapId);
      setRecord(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong generating the ADRs.');
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
      const markdown = await getAdrsMarkdown(mapId);
      const filename = `${slugify(productName) || 'mappr-export'}-adrs.md`;
      downloadTextFile(filename, markdown, 'text/markdown');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong rendering the Markdown.');
      }
    } finally {
      setIsDownloading(false);
    }
  }, [mapId, record, productName]);

  const techStackAdrs = record?.adrs.filter((a) => a.subjectType === 'tech_stack') ?? [];
  const architectureAdrs = record?.adrs.filter((a) => a.subjectType !== 'tech_stack') ?? [];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-canvas-grid bg-canvas p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-base font-semibold text-text">Architecture Decision Records</p>
          <p className="mt-1 font-body text-sm text-text-muted">
            {record
              ? `${record.adrs.length} decision${record.adrs.length === 1 ? '' : 's'} recorded`
              : 'No ADRs generated for the current tech stack and architecture yet.'}
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
              {isDownloading ? 'Rendering…' : '.md'}
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={isRunning || isLoading}
            className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <BookOpenTextIcon size={14} weight="bold" />
            {isRunning ? 'Generating…' : record ? 'Regenerate' : 'Generate ADRs'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger bg-surface px-4 py-2 font-body text-xs text-danger">
          {error}
        </div>
      )}

      {!isLoading && record && record.adrs.length === 0 && (
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
  );
}