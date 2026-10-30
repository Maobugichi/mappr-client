'use client';

import { useRef } from 'react';
import { DownloadIcon, RocketLaunchIcon } from '@phosphor-icons/react';
import { getDeployment, getDeploymentMarkdown, runDeployment } from '@/lib/api';
import { MarkdownContent } from '@/lib/markdown-render';
import { useGeneratedArtifact } from '@/lib/use-generated-artifact';
import { MotionDisclosure } from './MotionDisclosure';
import styles from './DeploymentView.module.css';

// The API resolves the current techStack + architecture hash. Commit its
// record and rendered Markdown together so counts always match the preview.
async function loadDeploymentPreview(mapId: string) {
  const record = await getDeployment(mapId);
  if (!record) return null;
  const markdown = await getDeploymentMarkdown(mapId);
  return { record, markdown };
}

async function generateDeploymentPreview(mapId: string) {
  const record = await runDeployment(mapId);
  const markdown = await getDeploymentMarkdown(mapId);
  return { record, markdown };
}

function DeploymentContent({ mapId }: { mapId: string }) {
  const generateTriggerRef = useRef<HTMLButtonElement>(null);
  const {
    record: preview, isLoading, isRunning, isDownloading, isReloading, isWorking, error,
    resultRevision, downloaded, runGeneration, runDownload, runReload,
  } = useGeneratedArtifact({
    mapId, load: loadDeploymentPreview, generate: generateDeploymentPreview,
    loadError: 'Could not load the saved deployment plan. Retry loading, or generate a new plan.',
    generationError: 'Could not generate the deployment plan and load its preview. Retry loading to check the saved plan, or try generating again.',
    exportError: 'Could not prepare the deployment plan download.',
  });

  // Export the exact displayed Markdown, including backend-rendered
  // connections and uncovered nodes, without another request.
  const handleDownload = (trigger: HTMLButtonElement) => {
    if (!preview) return;
    return runDownload(trigger, async () => ({
      filename: 'DEPLOYMENT.md', content: preview.markdown, mimeType: 'text/markdown',
    }));
  };

  const handleReload = (trigger: HTMLButtonElement) => {
    // The error panel becomes inert when loading starts. Use the stable main
    // action for focus restoration after the controller re-enables it.
    const stableTrigger = generateTriggerRef.current ?? trigger;
    if (document.activeElement === trigger) stableTrigger.focus({ preventScroll: true });
    return runReload(stableTrigger);
  };

  let statusMessage = 'No deployment plan generated for the current tech stack and architecture yet.';
  if (isLoading || isReloading) statusMessage = 'Loading saved deployment plan…';
  else if (isRunning) statusMessage = preview
    ? 'Generating deployment plan and preparing its preview. The displayed plan remains visible.'
    : 'Generating deployment plan and preparing its preview…';
  else if (isDownloading) statusMessage = 'Preparing DEPLOYMENT.md download…';
  else if (preview) {
    const count = preview.record.components.length;
    statusMessage = `${downloaded ? 'DEPLOYMENT.md download prepared. ' : ''}${count} component${count === 1 ? '' : 's'} planned`;
  } else if (error) statusMessage = 'No deployment plan is currently displayed.';

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-canvas-grid bg-canvas p-6">
      <div>
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-text">Deployment Plan</p>
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
                {isDownloading ? 'Preparing…' : 'DEPLOYMENT.md'}
              </button>
            )}
            <button
              ref={generateTriggerRef}
              onClick={(event) => void runGeneration(event.currentTarget)}
              disabled={isWorking || isLoading}
              aria-busy={isRunning || isReloading}
              className="flex items-center gap-2 rounded-full bg-signal px-4 py-2 font-mono text-xs uppercase tracking-wide text-canvas shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <RocketLaunchIcon size={14} weight="bold" />
              {isLoading || isReloading ? 'Loading…' : isRunning ? 'Generating…' : preview ? 'Regenerate' : 'Generate Plan'}
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
        <div role="region" aria-label="Deployment plan preview" tabIndex={0} className={`${styles.preview} max-h-[70vh] overflow-auto rounded-lg border border-canvas-grid bg-surface-raised p-4`}>
          <div key={resultRevision} className={styles.results}>
            {preview.markdown.trim() ? <MarkdownContent markdown={preview.markdown} /> : (
              <p className="font-body text-sm text-text-muted">The deployment plan is empty. Try regenerating.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DeploymentView(props: { mapId: string }) {
  return <DeploymentContent key={props.mapId} {...props} />;
}
