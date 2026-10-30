'use client';

import { useRef } from 'react';
import { FileTextIcon, DownloadIcon } from '@phosphor-icons/react';
import { getReadme, getReadmeMarkdown, runReadme } from '@/lib/api';
import { MarkdownContent } from '@/lib/markdown-render';
import { useGeneratedArtifact } from '@/lib/use-generated-artifact';
import { MotionDisclosure } from './MotionDisclosure';
import styles from './ReadmeView.module.css';

// Commit the record and its complete rendered Markdown together. A failed
// preview request must never pair a new version label with old content.
async function loadReadmePreview(mapId: string) {
  const record = await getReadme(mapId);
  if (!record) return null;
  const markdown = await getReadmeMarkdown(mapId);
  return { record, markdown };
}

async function generateReadmePreview(mapId: string) {
  const record = await runReadme(mapId);
  const markdown = await getReadmeMarkdown(mapId);
  return { record, markdown };
}

function ReadmeContent({ mapId }: { mapId: string }) {
  const generateTriggerRef = useRef<HTMLButtonElement>(null);
  const {
    record: preview, isLoading, isRunning, isDownloading, isReloading, isWorking, error,
    resultRevision, downloaded, runGeneration, runDownload, runReload,
  } = useGeneratedArtifact({
    mapId, load: loadReadmePreview, generate: generateReadmePreview,
    loadError: 'Could not load the saved README. Retry loading, or generate a new README.',
    generationError: 'Could not generate the README and load its preview. Retry loading to check the saved README, or try generating again.',
    exportError: 'Could not prepare the README download.',
  });

  const handleDownload = (trigger: HTMLButtonElement) => {
    if (!preview) return;
    return runDownload(trigger, async () => ({
      filename: 'README.md', content: preview.markdown, mimeType: 'text/markdown',
    }));
  };

  const handleReload = (trigger: HTMLButtonElement) => {
    // The error panel becomes inert as loading starts. Move focus to the
    // stable main action, which the controller can restore when it re-enables.
    const stableTrigger = generateTriggerRef.current ?? trigger;
    if (document.activeElement === trigger) stableTrigger.focus({ preventScroll: true });
    return runReload(stableTrigger);
  };

  let statusMessage = 'No README generated for the current version yet.';
  if (isLoading || isReloading) statusMessage = 'Loading saved README…';
  else if (isRunning) statusMessage = preview
    ? `Generating README and preparing its preview. The displayed v${preview.record.version} remains visible.`
    : 'Generating README and preparing its preview…';
  else if (isDownloading) statusMessage = 'Preparing README download…';
  else if (preview) statusMessage = `${downloaded ? 'README download prepared. ' : ''}Generated for v${preview.record.version}`;
  else if (error) statusMessage = 'No README is currently displayed.';

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-canvas-grid bg-canvas p-6">
      <div>
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-text">README</p>
            <p role="status" aria-atomic="true" className="mt-1 font-body text-sm text-text-muted">
              {statusMessage}
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 lg:w-auto">
            {preview && (
              <button
                onClick={(event) => void handleDownload(event.currentTarget)}
                disabled={isWorking}
                aria-busy={isDownloading}
                className="flex items-center gap-2 rounded-full border border-canvas-grid px-4 py-2 font-mono text-xs uppercase tracking-wide text-text-muted shadow-lg transition-colors hover:bg-surface-raised hover:text-text disabled:opacity-60"
              >
                <DownloadIcon size={14} weight="bold" />
                {isDownloading ? 'Preparing…' : 'README.md'}
              </button>
            )}
            <button
              ref={generateTriggerRef}
              onClick={(event) => void runGeneration(event.currentTarget)}
              disabled={isWorking || isLoading}
              aria-busy={isRunning || isReloading}
              className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <FileTextIcon size={14} weight="bold" />
              {isLoading || isReloading ? 'Loading…' : isRunning ? 'Generating…' : preview ? 'Regenerate' : 'Generate README'}
            </button>
          </div>
        </div>

        <MotionDisclosure isOpen={Boolean(error)}>
          <div className="mt-4 rounded-lg border border-danger bg-surface px-4 py-3 font-body text-xs text-danger">
            <p role="alert">{error}</p>
            <button
              onClick={(event) => void handleReload(event.currentTarget)}
              disabled={isWorking || isLoading}
              className="mt-2 rounded-full border border-danger/40 px-3 py-1 font-mono text-[10px] uppercase tracking-wide hover:bg-danger/10 disabled:opacity-60"
            >
              Retry loading
            </button>
          </div>
        </MotionDisclosure>
      </div>

      {preview && (
        <div role="region" aria-label="README preview" tabIndex={0} className={`${styles.preview} max-h-[70vh] overflow-auto rounded-lg border border-canvas-grid bg-surface-raised p-4`}>
          <div key={resultRevision} className={styles.results}>
            {preview.markdown.trim() ? <MarkdownContent markdown={preview.markdown} /> : (
              <p className="font-body text-sm text-text-muted">The README is empty. Try regenerating.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReadmeView(props: { mapId: string; productName: string }) {
  return <ReadmeContent key={props.mapId} mapId={props.mapId} />;
}
