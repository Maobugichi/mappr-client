'use client';

import { useState } from 'react';
import { DatabaseIcon, DownloadIcon } from '@phosphor-icons/react';
import { getDocumentSchema, getDocumentSchemaScript, runDocumentSchema } from '@/lib/api';
import { useSchemaArtifact } from '@/lib/use-schema-artifact';
import { ActionButton } from './ActionButton';
import { MotionDisclosure } from './MotionDisclosure';
import { SchemaExplorer } from './SchemaExplorer';
import styles from './SchemaView.module.css';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function DocumentSchemaView({ mapId, productName }: { mapId: string; productName: string }) {
  const {
    schema, isLoading, isRunning, isDownloading, isReloading, isWorking, error,
    resultRevision, downloaded, runGeneration, runDownload, runReload,
  } = useSchemaArtifact({
    mapId, load: getDocumentSchema, generate: runDocumentSchema,
    label: 'document schema', exportError: 'Something went wrong rendering the script.',
  });
  const [lastAction, setLastAction] = useState<'load' | 'generate' | 'download'>('load');
  const handleRun = (trigger: HTMLButtonElement) => {
    if (lastAction === 'load' && error) return runReload(trigger);
    setLastAction('generate');
    return runGeneration(trigger);
  };
  const handleDownload = (trigger: HTMLButtonElement) => {
    if (!schema) return;
    setLastAction('download');
    return runDownload(trigger, async () => {
      const script = await getDocumentSchemaScript(mapId);
      return {
        filename: `${slugify(productName) || 'mappr-export'}-mongo-v${schema.version}.js`,
        content: script, mimeType: 'application/javascript',
      };
    });
  };
  const pending = isLoading || isRunning || isReloading;

  return (
    <section className={styles.schemaView} aria-label="Document Schema Explorer">
      <header className={styles.header}>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}>Document schema</p>
          <h2 className={styles.title}>Schema Explorer</h2>
          <p role="status" aria-atomic="true" className={styles.version}>
            {schema ? `Displayed schema v${schema.version} · ${schema.collections.length} collection${schema.collections.length === 1 ? '' : 's'}`
              : 'No document schema is currently displayed.'}
          </p>
        </div>
        <div className={styles.actions}>
          {schema && <ActionButton data-schema-export compactPending variant="secondary" disabled={isWorking}
            onClick={(event) => void handleDownload(event.currentTarget)}
            state={isDownloading ? 'pending' : error && lastAction === 'download' ? 'error' : downloaded ? 'success' : 'idle'}
            idleLabel="JavaScript export" pendingLabel="Preparing document schema JavaScript download"
            successLabel="Download JavaScript again" errorLabel="Retry script export" icon={<DownloadIcon size={14} weight="bold" />} />}
          <ActionButton data-schema-action compactPending disabled={isWorking}
            onClick={(event) => void handleRun(event.currentTarget)}
            state={pending ? 'pending' : error && lastAction !== 'download' ? 'error' : resultRevision > 0 && schema ? 'success' : 'idle'}
            idleLabel={schema ? 'Regenerate' : 'Generate schema'}
            pendingLabel={isLoading || isReloading ? 'Loading saved document schema' : 'Generating document schema'}
            successLabel={schema ? 'Regenerate' : 'Generate schema'}
            errorLabel={lastAction === 'load' ? 'Retry loading' : 'Retry generation'} icon={<DatabaseIcon size={14} weight="bold" />} />
        </div>
      </header>
      <MotionDisclosure isOpen={Boolean(error)}><p role="alert" className={styles.error}>{error}</p></MotionDisclosure>
      {schema ? schema.collections.length > 0 ? <SchemaExplorer mode="document" items={schema.collections} />
        : <p className={styles.empty}>No collections were generated. Regenerate to try again.</p>
        : <p className={styles.empty}>Generated collection definitions will appear here.</p>}
      <p className="sr-only" role="status" aria-atomic="true">
        {isRunning ? `Generating a document schema. ${schema ? `Displayed v${schema.version} remains available.` : ''}`
          : downloaded ? 'JavaScript download prepared.' : ''}
      </p>
    </section>
  );
}
