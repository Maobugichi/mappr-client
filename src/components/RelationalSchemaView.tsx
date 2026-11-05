'use client';

import { useEffect, type ReactNode } from 'react';
import { DatabaseIcon } from '@phosphor-icons/react';
import type { RelationalDialect } from '@/lib/api';
import { getRelationalSchema, getRelationalSchemaSql, runRelationalSchema } from '@/lib/api';
import { useSchemaArtifact } from '@/lib/use-schema-artifact';
import { usePreservedViewState } from '@/lib/artifact-workspace';
import { ArtifactActionButton, ArtifactActions } from './ArtifactActions';
import { MotionDisclosure } from './MotionDisclosure';
import { SchemaExplorer } from './SchemaExplorer';
import { SchemaEngineSelect } from './SchemaEngineSelect';
import styles from './SchemaView.module.css';

const DIALECT_LABEL: Record<RelationalDialect, string> = {
  postgres: 'PostgreSQL', mysql: 'MySQL', sqlite: 'SQLite',
};
const DIALECT_OPTIONS = (Object.entries(DIALECT_LABEL) as [RelationalDialect, string][])
  .map(([value, label]) => ({ value, label }));

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function RelationalSchemaView({ mapId, productName, modeControls, onAvailabilityChange }: {
  mapId: string; productName: string; modeControls?: ReactNode;
  onAvailabilityChange?: (available: boolean | null) => void;
}) {
  const {
    schema, isLoading, isRunning, isDownloading, isReloading, isWorking, error,
    resultRevision, downloaded, runGeneration, runDownload, runReload,
  } = useSchemaArtifact({
    mapId, load: getRelationalSchema, generate: runRelationalSchema,
    label: 'relational schema', exportError: 'Something went wrong rendering the SQL.',
  });
  const [dialect, setDialect] = usePreservedViewState<RelationalDialect>('schema:dialect', 'postgres');
  const [lastAction, setLastAction] = usePreservedViewState<'load' | 'generate' | 'download'>('RelationalSchemaView:last-action', 'load');
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
    return runDownload(trigger, async () => {
      // SQL is rendered by the existing backend endpoint for the chosen engine.
      const sql = await getRelationalSchemaSql(mapId, dialect);
      return {
        filename: `${slugify(productName) || 'mappr-export'}-${dialect}-v${schema.version}.sql`,
        content: sql, mimeType: 'application/sql',
      };
    });
  };
  const pending = isLoading || isRunning || isReloading;

  return (
    <section className={styles.schemaView} aria-label="Relational Schema Explorer">
      <header className={styles.header}>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}>Relational schema</p>
          <h2 tabIndex={-1} className={styles.title}>Schema Explorer</h2>
          <p role="status" aria-atomic="true" className={styles.version}>
            {schema ? `Displayed schema v${schema.version} · ${schema.tables.length} table${schema.tables.length === 1 ? '' : 's'}`
              : 'No relational schema is currently displayed.'}
          </p>
        </div>
        <ArtifactActions>
          {modeControls}
          {schema && <>
            <SchemaEngineSelect value={dialect} options={DIALECT_OPTIONS} onChange={setDialect} disabled={isDownloading} />
            <ArtifactActionButton action="export" data-schema-export variant="secondary" disabled={isWorking} title={`Export ${DIALECT_LABEL[dialect]} SQL`}
              onClick={(event) => void handleDownload(event.currentTarget)}
              state={isDownloading ? 'pending' : error && lastAction === 'download' ? 'error' : downloaded ? 'success' : 'idle'}
              idleLabel={`Export ${DIALECT_LABEL[dialect]} SQL`} pendingLabel={`Preparing ${DIALECT_LABEL[dialect]} SQL download`}
              successLabel="Download SQL again" errorLabel="Retry SQL export"  />
          </>}
          <ArtifactActionButton action="generate" regenerate={Boolean(schema)} data-schema-action disabled={isWorking} title={schema ? 'Regenerate relational schema' : 'Generate relational schema'}
            onClick={(event) => void handleRun(event.currentTarget)}
            state={pending ? 'pending' : error && lastAction !== 'download' ? 'error' : resultRevision > 0 && schema ? 'success' : 'idle'}
            idleLabel={schema ? 'Regenerate' : 'Generate schema'}
            pendingLabel={isLoading || isReloading ? 'Loading saved relational schema' : 'Generating relational schema'}
            successLabel={schema ? 'Regenerate' : 'Generate schema'}
            errorLabel={lastAction === 'load' ? 'Retry loading' : 'Retry generation'}
            icon={<DatabaseIcon size={14} weight="bold" />} />
        </ArtifactActions>
      </header>
      <MotionDisclosure isOpen={Boolean(error)}><p role="alert" className={styles.error}>{error}</p></MotionDisclosure>
      {schema ? schema.tables.length > 0 ? <SchemaExplorer mode="relational" items={schema.tables} />
        : <p className={styles.empty}>No tables were generated. Regenerate to try again.</p>
        : <p className={styles.empty}>Generated table definitions will appear here.</p>}
      <p className="sr-only" role="status" aria-atomic="true">
        {isRunning ? `Generating a relational schema. ${schema ? `Displayed v${schema.version} remains available.` : ''}`
          : downloaded ? 'SQL download prepared.' : ''}
      </p>
    </section>
  );
}
