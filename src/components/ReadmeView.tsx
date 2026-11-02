'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { FileTextIcon, DownloadIcon, ListIcon } from '@phosphor-icons/react';
import { getReadme, getReadmeMarkdown, runReadme } from '@/lib/api';
import { prepareReadmeDocument, type ReadmeDocument } from '@/lib/readme-markdown';
import { useGeneratedArtifact } from '@/lib/use-generated-artifact';
import { ActionButton } from './ActionButton';
import { MotionDisclosure } from './MotionDisclosure';
import { ReadmeMarkdown } from './ReadmeMarkdown';
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

function ReadmeOutline({ headings }: { headings: ReadmeDocument['headings'] }) {
  const outlineRef = useRef<HTMLDetailsElement>(null);
  return <details ref={outlineRef} className={styles.outline} onKeyDown={(event) => {
    if (event.key !== 'Escape' || !event.currentTarget.open) return;
    event.preventDefault();
    event.currentTarget.open = false;
    event.currentTarget.querySelector('summary')?.focus();
  }}>
    <summary><ListIcon size={14} weight="bold" aria-hidden="true" />Outline</summary>
    <nav aria-label="README outline">
      <ol>{headings.map((heading) => <li key={heading.id} data-depth={heading.depth}>
        <a href={'#' + encodeURIComponent(heading.id)} onClick={() => {
          if (outlineRef.current) outlineRef.current.open = false;
          document.getElementById(heading.id)?.focus({ preventScroll: true });
        }}>{heading.text}</a>
      </li>)}</ol>
    </nav>
  </details>;
}

function ReadmeContent({ mapId }: { mapId: string }) {
  const documentId = useId();
  const generateTriggerRef = useRef<HTMLButtonElement>(null);
  const [lastAction, setLastAction] = useState<'load' | 'generate' | 'download'>('load');
  const {
    record: preview, isLoading, isRunning, isDownloading, isReloading, isWorking, error,
    downloaded, runGeneration, runDownload, runReload,
  } = useGeneratedArtifact({
    mapId, load: loadReadmePreview, generate: generateReadmePreview,
    loadError: 'Could not load the saved README. Retry loading, or generate a new README.',
    generationError: 'Could not generate the README and load its preview. Retry loading to check the saved README, or try generating again.',
    exportError: 'Could not prepare the README download.',
  });
  const markdown = preview?.markdown;
  const document = useMemo(() => markdown === undefined ? null : prepareReadmeDocument(markdown, 'readme-' + documentId), [markdown, documentId]);

  const handleDownload = (trigger: HTMLButtonElement) => {
    if (!preview || isWorking || isLoading) return;
    setLastAction('download');
    return runDownload(trigger, async () => ({
      filename: 'README.md', content: preview.markdown, mimeType: 'text/markdown',
    }));
  };

  const handleReload = (trigger: HTMLButtonElement) => {
    // The error panel becomes inert as loading starts. Move focus to the
    // stable main action, which the controller can restore when it re-enables.
    const stableTrigger = generateTriggerRef.current ?? trigger;
    if (window.document.activeElement === trigger) stableTrigger.focus({ preventScroll: true });
    setLastAction('load');
    return runReload(stableTrigger);
  };
  const handleGenerate = (trigger: HTMLButtonElement) => {
    if (isLoading || isWorking) return;
    setLastAction('generate');
    return runGeneration(trigger);
  };
  const pending = isLoading || isRunning || isReloading;

  let statusMessage = 'No README generated for the current version yet.';
  if (isLoading || isReloading) statusMessage = 'Loading saved README…';
  else if (isRunning) statusMessage = preview
    ? `Generating README and preparing its preview. The displayed v${preview.record.version} remains visible.`
    : 'Generating README and preparing its preview…';
  else if (isDownloading) statusMessage = 'Preparing README download…';
  else if (preview) statusMessage = `${downloaded ? 'README download prepared. ' : ''}Generated for v${preview.record.version}`;
  else if (error) statusMessage = 'No README is currently displayed.';

  return (
    <section className={styles.file} aria-label="Repository file preview">
      <header className={styles.fileHeader}>
        <div className={styles.fileIdentity}>
          <FileTextIcon size={16} className={styles.fileIcon} aria-hidden="true" />
          <h2>README.md</h2>
          {preview && <span className={styles.version}>v{preview.record.version}</span>}
        </div>
        <div className={styles.actions}>
          {document && document.headings.length > 0 && <ReadmeOutline headings={document.headings} />}
          {preview && <ActionButton compactPending variant="secondary" disabled={isWorking || isLoading}
            onClick={(event) => void handleDownload(event.currentTarget)}
            state={error && lastAction === 'download' ? 'error' : downloaded ? 'success' : 'idle'}
            idleLabel="Markdown export" pendingLabel="Preparing README download" successLabel="Markdown export" errorLabel="Retry export"
            icon={<DownloadIcon size={14} weight="bold" />} />}
          <ActionButton ref={generateTriggerRef} compactPending disabled={isWorking || isLoading}
            onClick={(event) => void handleGenerate(event.currentTarget)}
            state={pending ? 'pending' : error && lastAction === 'generate' ? 'error' : 'idle'}
            idleLabel={preview ? 'Regenerate' : 'Generate README'}
            pendingLabel={isLoading || isReloading ? 'Loading saved README' : 'Generating README and preparing its preview'}
            errorLabel="Retry generation" icon={<FileTextIcon size={14} weight="bold" />} />
        </div>
      </header>
      <p role="status" aria-atomic="true" className="sr-only">{statusMessage}</p>
      <MotionDisclosure isOpen={Boolean(error)}>
          <div className={styles.error}>
            <p role="alert">{error}</p>
            <button
              onClick={(event) => void handleReload(event.currentTarget)}
              disabled={isWorking || isLoading}
              className={styles.retry}
            >
              Retry loading
            </button>
          </div>
      </MotionDisclosure>
      {document && preview ? <article className={styles.document} aria-label="README.md contents">
        {preview.markdown.trim() ? <ReadmeMarkdown document={document} />
          : <p className={styles.empty}>The README is empty. Try regenerating.</p>}
      </article> : !pending && !error && <p className={styles.empty}>No README generated for the current version yet.</p>}
    </section>
  );
}

export function ReadmeView(props: { mapId: string; productName: string }) {
  return <ReadmeContent key={props.mapId} mapId={props.mapId} />;
}
