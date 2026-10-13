'use client';

import { useCallback, useEffect, useState } from 'react';
import { DownloadIcon, RocketLaunchIcon } from '@phosphor-icons/react';
import type { DeploymentRecord } from '@/lib/api';
import { ApiError, getDeployment, getDeploymentMarkdown, runDeployment } from '@/lib/api';
import { downloadTextFile } from '@/lib/markdown-export';
import { MarkdownContent } from '@/lib/markdown-render';

export function DeploymentView({ mapId }: { mapId: string }) {
  const [record, setRecord] = useState<DeploymentRecord | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same convention as ReadmeView — load any previously persisted plan
  // for the map's CURRENT techStack+architecture hash on mount. getDeployment
  // (JSON) and getDeploymentMarkdown (the rendered plan) read the same
  // stored row, so the markdown fetch only runs once a record is known to
  // exist. A stale plan from a since-changed hash is not what this returns.
  useEffect(() => {
    let cancelled = false;
    getDeployment(mapId)
      .then(async (existing) => {
        if (cancelled || !existing) return;
        setRecord(existing);
        const md = await getDeploymentMarkdown(mapId);
        if (!cancelled) setMarkdown(md);
      })
      .catch((err) => {
        console.error('Failed to load existing deployment plan:', err);
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
      const result = await runDeployment(mapId);
      setRecord(result);
      const md = await getDeploymentMarkdown(mapId);
      setMarkdown(md);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong generating the deployment plan.');
      }
    } finally {
      setIsRunning(false);
    }
  }, [mapId]);

  // The download is the exact Markdown shown on screen — no second
  // fetch, so what you see is what you get.
  const handleDownload = useCallback(() => {
    if (!markdown) return;
    downloadTextFile('DEPLOYMENT.md', markdown, 'text/markdown');
  }, [markdown]);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-canvas-grid bg-canvas p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-base font-semibold text-text">Deployment Plan</p>
          <p className="mt-1 font-body text-sm text-text-muted">
            {record
              ? `${record.components.length} component${record.components.length === 1 ? '' : 's'} planned`
              : 'No deployment plan generated for the current tech stack and architecture yet.'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {markdown && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-full border border-canvas-grid px-4 py-2 font-mono text-xs uppercase tracking-wide text-text-muted shadow-lg transition-colors hover:bg-surface-raised hover:text-text"
            >
              <DownloadIcon size={14} weight="bold" />
              DEPLOYMENT.md
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={isRunning || isLoading}
            className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <RocketLaunchIcon size={14} weight="bold" />
            {isRunning ? 'Generating…' : record ? 'Regenerate' : 'Generate Plan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger bg-surface px-4 py-2 font-body text-xs text-danger">
          {error}
        </div>
      )}

      {markdown && (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-canvas-grid bg-surface-raised p-4">
          <MarkdownContent markdown={markdown} />
        </div>
      )}
    </div>
  );
}