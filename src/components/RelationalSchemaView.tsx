'use client';

import { useState } from 'react';
import { DatabaseIcon, DownloadIcon } from '@phosphor-icons/react';
import type { RelationalDialect } from '@/lib/api';
import { getRelationalSchema, getRelationalSchemaSql, runRelationalSchema } from '@/lib/api';
import { useSchemaArtifact } from '@/lib/use-schema-artifact';
import { ActionButton } from './ActionButton';
import { MotionDisclosure } from './MotionDisclosure';
import { SchemaExplorer } from './SchemaExplorer';
import styles from './SchemaView.module.css';

const DIALECT_LABEL: Record<RelationalDialect, string> = {
  postgres: 'PostgreSQL', mysql: 'MySQL', sqlite: 'SQLite',
};

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function RelationalSchemaView({ mapId, productName }: { mapId: string; productName: string }) {
  const {
    schema, isLoading, isRunning, isDownloading, isReloading, isWorking, error,
    resultRevision, downloaded, runGeneration, runDownload, runReload,
  } = useSchemaArtifact({
    mapId, load: getRelationalSchema, generate: runRelationalSchema,
    label: 'relational schema', exportError: 'Something went wrong rendering the SQL.',
  });
  const [dialect, setDialect] = useState<RelationalDialect>('postgres');
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
          <h2 className={styles.title}>Schema Explorer</h2>
          <p role="status" aria-atomic="true" className={styles.version}>
            {schema ? `Displayed schema v${schema.version} · ${schema.tables.length} table${schema.tables.length === 1 ? '' : 's'}`
              : 'No relational schema is currently displayed.'}
          </p>
        </div>
        <div className={styles.actions}>
          {schema && <>
            <select value={dialect} aria-label="SQL dialect" disabled={isDownloading}
              onChange={(event) => setDialect(event.target.value as RelationalDialect)} className={styles.engineSelect}>
              {Object.entries(DIALECT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <ActionButton data-schema-export compactPending variant="secondary" disabled={isWorking}
              onClick={(event) => void handleDownload(event.currentTarget)}
              state={isDownloading ? 'pending' : error && lastAction === 'download' ? 'error' : downloaded ? 'success' : 'idle'}
              idleLabel="SQL export" pendingLabel={`Preparing ${DIALECT_LABEL[dialect]} SQL download`}
              successLabel="Download SQL again" errorLabel="Retry SQL export" icon={<DownloadIcon size={14} weight="bold" />} />
          </>}
          <ActionButton data-schema-action compactPending disabled={isWorking}
            onClick={(event) => void handleRun(event.currentTarget)}
            state={pending ? 'pending' : error && lastAction !== 'download' ? 'error' : resultRevision > 0 && schema ? 'success' : 'idle'}
            idleLabel={schema ? 'Regenerate' : 'Generate schema'}
            pendingLabel={isLoading || isReloading ? 'Loading saved relational schema' : 'Generating relational schema'}
            successLabel={schema ? 'Regenerate' : 'Generate schema'}
            errorLabel={lastAction === 'load' ? 'Retry loading' : 'Retry generation'} icon={<DatabaseIcon size={14} weight="bold" />} />
        </div>
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
