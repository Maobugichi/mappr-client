'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileTextIcon, DownloadIcon } from '@phosphor-icons/react';
import type { ReadmeRecord } from '@/lib/api';
import { ApiError, getReadme, getReadmeMarkdown, runReadme } from '@/lib/api';
import { downloadTextFile } from '@/lib/markdown-export';
import { MarkdownContent } from '@/lib/markdown-render';

export function ReadmeView({ mapId }: { mapId: string; productName: string }) {
  const [record, setRecord] = useState<ReadmeRecord | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same convention as the other views — load any previously persisted
  // README on mount. getReadme (JSON) and getReadmeMarkdown (full
  // rendered text) are the same underlying stored row, so the markdown
  // fetch only runs once we know a record actually exists.
  useEffect(() => {
    let cancelled = false;
    getReadme(mapId)
      .then(async (existing) => {
        if (cancelled || !existing) return;
        setRecord(existing);
        const md = await getReadmeMarkdown(mapId);
        if (!cancelled) setMarkdown(md);
      })
      .catch((err) => {
        console.error('Failed to load existing README:', err);
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
      const result = await runReadme(mapId);
      setRecord(result);
      const md = await getReadmeMarkdown(mapId);
      setMarkdown(md);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('Something went wrong generating the README.');
      }
    } finally {
      setIsRunning(false);
    }
  }, [mapId]);

  const handleDownload = useCallback(() => {
    if (!markdown) return;
    downloadTextFile('README.md', markdown, 'text/markdown');
  }, [markdown]);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-canvas-grid bg-canvas p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-base font-semibold text-text">README</p>
          <p className="mt-1 font-body text-sm text-text-muted">
            {record ? `Generated for v${record.version}` : 'No README generated for the current version yet.'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {markdown && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-full border border-canvas-grid px-4 py-2 font-mono text-xs uppercase tracking-wide text-text-muted shadow-lg transition-colors hover:bg-surface-raised hover:text-text"
            >
              <DownloadIcon size={14} weight="bold" />
              README.md
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={isRunning || isLoading}
            className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <FileTextIcon size={14} weight="bold" />
            {isRunning ? 'Generating…' : record ? 'Regenerate' : 'Generate README'}
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