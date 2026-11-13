'use client';

import { useEffect, type ReactNode } from 'react';
import { DatabaseIcon } from '@phosphor-icons/react';
import { getDocumentSchema, getDocumentSchemaScript, runDocumentSchema } from '@/lib/api';
import { useSchemaArtifact } from '@/lib/use-schema-artifact';
import { usePreservedViewState } from '@/lib/artifact-workspace';
import { ArtifactActionButton, ArtifactActions } from './ArtifactActions';
import { MotionDisclosure } from './MotionDisclosure';
import { ArtifactSafety } from './ArtifactSafety';
import { exportExpectation } from '@/lib/artifact-safety';
import { SchemaExplorer } from './SchemaExplorer';
import { SchemaEngineBadge } from './SchemaEngineSelect';
import styles from './SchemaView.module.css';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function DocumentSchemaView({ mapId, productName, modeControls, onAvailabilityChange }: {
  mapId: string; productName: string; modeControls?: ReactNode;
  onAvailabilityChange?: (available: boolean | null) => void;
}) {
  const {
    schema, isLoading, isRunning, isDownloading, isReloading, isWorking, error,
    resultRevision, downloaded, safety, runGeneration, runDownload, runReload,
  } = useSchemaArtifact({
    mapId, kind: 'document_schema', load: getDocumentSchema, generate: runDocumentSchema,
    label: 'document schema', exportError: 'Something went wrong rendering the script.',
  });
  const [lastAction, setLastAction] = usePreservedViewState<'load' | 'generate' | 'download'>('DocumentSchemaView:last-action', 'load');
  const available = schema ? true : isLoading || isReloading ? null : false;
  useEffect(() => { onAvailabilityChange?.(available); }, [available, onAvailabilityChange]);
  const handleRun = (trigger: HTMLButtonElement) => {
    if (lastAction === 'load' && error) return runReload(trigger);
    setLastAction('generate');
    return runGeneration(trigger);
  };
  const handleDownload = (trigger: HTMLButtonElement) => {
    if (!schema) return;
    setLastAction('download');
    return runDownload(trigger, async (fresh) => {
      const script = await getDocumentSchemaScript(mapId, exportExpectation(fresh));
      return {
        filename: `${slugify(productName) || 'mappr-export'}-mongo-v${fresh.version}.js`,
        content: script, mimeType: 'application/javascript',
      };
    });
  };
  const pending = isLoading || isRunning || isReloading;

  return (
    <ArtifactSafety safety={safety}><section className={styles.schemaView} aria-label="Document Schema Explorer">
      <header className={styles.header}>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}>Document schema</p>
          <h2 tabIndex={-1} className={styles.title}>Schema Explorer</h2>
          <p role="status" aria-atomic="true" className={styles.version}>
            {schema ? `Displayed schema v${schema.version} · ${schema.collections.length} collection${schema.collections.length === 1 ? '' : 's'}`
              : 'No document schema is currently displayed.'}
          </p>
        </div>
        <ArtifactActions>
          {modeControls}
          {schema && <><SchemaEngineBadge name="MongoDB" />
          <ArtifactActionButton action="export" data-schema-export variant="secondary" disabled={isWorking} title="Export MongoDB JavaScript"
            onClick={(event) => void handleDownload(event.currentTarget)}
            state={isDownloading ? 'pending' : error && lastAction === 'download' ? 'error' : downloaded ? 'success' : 'idle'}
            idleLabel="Export MongoDB JavaScript" pendingLabel="Preparing document schema JavaScript download"
            successLabel="Download JavaScript again" errorLabel="Retry script export"  /></>}
          <ArtifactActionButton action="generate" regenerate={Boolean(schema)} data-schema-action disabled={isWorking} title={schema ? 'Regenerate document schema' : 'Generate document schema'}
            onClick={(event) => void handleRun(event.currentTarget)}
            state={pending ? 'pending' : error && lastAction !== 'download' ? 'error' : resultRevision > 0 && schema ? 'success' : 'idle'}
            idleLabel={schema ? 'Regenerate' : 'Generate schema'}
            pendingLabel={isLoading || isReloading ? 'Loading saved document schema' : 'Generating document schema'}
            successLabel={schema ? 'Regenerate' : 'Generate schema'}
            errorLabel={lastAction === 'load' ? 'Retry loading' : 'Retry generation'}
            icon={<DatabaseIcon size={14} weight="bold" />} />
        </ArtifactActions>
      </header>
      <MotionDisclosure isOpen={Boolean(error)}><p role="alert" className={styles.error}>{error}</p></MotionDisclosure>
      {schema ? schema.collections.length > 0 ? <SchemaExplorer mode="document" items={schema.collections} />
        : <p className={styles.empty}>No collections were generated. Regenerate to try again.</p>
        : <p className={styles.empty}>Generated collection definitions will appear here.</p>}
      <p className="sr-only" role="status" aria-atomic="true">
        {isRunning ? `Generating a document schema. ${schema ? `Displayed v${schema.version} remains available.` : ''}`
          : downloaded ? 'JavaScript download prepared.' : ''}
      </p>
    </section></ArtifactSafety>
  );
}
