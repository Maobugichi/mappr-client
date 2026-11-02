'use client';

import { useMemo, useRef } from 'react';
import { DownloadIcon, RocketLaunchIcon } from '@phosphor-icons/react';
import { getDeployment, getDeploymentMarkdown, runDeployment } from '@/lib/api';
import { prepareDeploymentDocument } from '@/lib/deployment-runbook';
import { useGeneratedArtifact } from '@/lib/use-generated-artifact';
import { ActionButton } from './ActionButton';
import { DeploymentMarkdown } from './DeploymentMarkdown';
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
    downloaded, runGeneration, runDownload, runReload,
  } = useGeneratedArtifact({
    mapId, load: loadDeploymentPreview, generate: generateDeploymentPreview,
    loadError: 'Could not load the saved deployment plan. Retry loading, or generate a new plan.',
    generationError: 'Could not generate the deployment plan and load its preview. Retry loading to check the saved plan, or try generating again.',
    exportError: 'Could not prepare the deployment plan download.',
  });
  const markdown = preview?.markdown;
  const runbook = useMemo(() => markdown === undefined ? null : prepareDeploymentDocument(markdown), [markdown]);
  const pending = isLoading || isRunning || isReloading;

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
    <section className={styles.workspace} aria-label="Deployment runbook">
      <div>
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-text">Deployment Runbook</h2>
            {preview && <p className={styles.summary}>{preview.record.components.length} component{preview.record.components.length === 1 ? '' : 's'} planned</p>}
            <p role="status" aria-atomic="true" className="sr-only">{statusMessage}</p>
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 lg:w-auto">
            {preview && (
              <ActionButton compactPending variant="secondary"
                onClick={(event) => void handleDownload(event.currentTarget)}
                disabled={isWorking || isLoading}
                idleLabel="Markdown export" pendingLabel="Preparing deployment download"
                icon={<DownloadIcon size={14} weight="bold" />} />
            )}
            <ActionButton compactPending
              ref={generateTriggerRef}
              onClick={(event) => void runGeneration(event.currentTarget)}
              disabled={isWorking || isLoading}
              state={pending ? 'pending' : 'idle'}
              idleLabel={preview ? 'Regenerate' : 'Generate Plan'}
              pendingLabel={isLoading || isReloading ? 'Loading saved deployment plan' : 'Generating deployment plan and preparing its preview'}
              icon={<RocketLaunchIcon size={14} weight="bold" />} />
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

      {preview && runbook ? (
        <article aria-label="Deployment instructions" className={styles.document}>
            {preview.markdown.trim() ? <DeploymentMarkdown document={runbook} /> : (
              <p className="font-body text-sm text-text-muted">The deployment plan is empty. Try regenerating.</p>
            )}
        </article>
      ) : !pending && !error && <p className={styles.summary}>{statusMessage}</p>}
    </section>
  );
}

export function DeploymentView(props: { mapId: string }) {
  return <DeploymentContent key={props.mapId} {...props} />;
}
