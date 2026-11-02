'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckIcon, CopyIcon, DownloadIcon, GearSixIcon, WarningIcon } from '@phosphor-icons/react';
import type { EnvVar, MapprSystem } from '@/lib/api';
import { getEnvVars, getEnvVarsFile, runEnvVars } from '@/lib/api';
import { assertSafeEnvTemplate, envExamplePolicy, UnsafeEnvExampleError } from '@/lib/env-vars-reference';
import { useGeneratedArtifact } from '@/lib/use-generated-artifact';
import { ActionButton } from './ActionButton';
import { MotionDisclosure } from './MotionDisclosure';
import styles from './EnvVarsView.module.css';

type Section = { key: string; title: string; vars: EnvVar[] };

// Keep the backend's grouping rule: shared/orphaned variables under General,
// followed by each architecture node with variables, in its original order.
function groupIntoSections(vars: EnvVar[], nodes: MapprSystem['architecture']['nodes']): Section[] {
  const knownIds = new Set(nodes.map((n) => n.id));
  const sections: Section[] = [];
  const general = vars.filter((v) => v.nodeId === null || !knownIds.has(v.nodeId));
  if (general.length > 0) sections.push({ key: 'general', title: 'General', vars: general });
  for (const node of nodes) {
    const nodeVars = vars.filter((v) => v.nodeId === node.id);
    if (nodeVars.length > 0) sections.push({ key: `node:${node.id}`, title: node.label, vars: nodeVars });
  }
  return sections;
}

function EnvVarRow({ envVar }: { envVar: EnvVar }) {
  const feedbackId = useId();
  const policy = envExamplePolicy(envVar);
  const [result, setResult] = useState<{ variable: EnvVar; target: 'name' | 'example'; state: 'copied' | 'failed' } | null>(null);
  const current = result?.variable === envVar ? result : null;
  const pending = useRef(false);
  const request = useRef(0);
  const resetTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => {
    request.current++;
    pending.current = false;
    window.clearTimeout(resetTimer.current);
  }, [envVar]);

  const copy = async (target: 'name' | 'example') => {
    if (pending.current || (target === 'example' && !policy.canCopy)) return;
    pending.current = true;
    const currentRequest = ++request.current;
    window.clearTimeout(resetTimer.current);
    setResult(null);
    try {
      await navigator.clipboard.writeText(target === 'name' ? envVar.name : envVar.placeholder);
      if (currentRequest !== request.current) return;
      setResult({ variable: envVar, target, state: 'copied' });
      resetTimer.current = window.setTimeout(() => {
        resetTimer.current = undefined;
        setResult(null);
      }, 2000);
    } catch {
      if (currentRequest === request.current) setResult({ variable: envVar, target, state: 'failed' });
    } finally {
      if (currentRequest === request.current) pending.current = false;
    }
  };
  const copyButton = (target: 'name' | 'example') => {
    const state = current?.target === target ? current.state : 'idle';
    return <button type="button" className={styles.copyButton} data-state={state}
      aria-label={target === 'name' ? `Copy ${envVar.name} variable name` : `Copy example for ${envVar.name}`}
      aria-describedby={state === 'failed' ? feedbackId : undefined}
      title={state === 'copied' ? 'Copied' : state === 'failed' ? 'Retry copying' : target === 'name' ? 'Copy variable name' : 'Copy example'}
      onClick={() => void copy(target)}>
      {state === 'copied' ? <CheckIcon size={14} weight="bold" aria-hidden="true" />
        : state === 'failed' ? <WarningIcon size={14} aria-hidden="true" /> : <CopyIcon size={14} aria-hidden="true" />}
    </button>;
  };

  return <li className={styles.variable}>
    <div className={styles.variableHeader}>
      <div className={styles.nameLine}><code className={styles.variableName}>{envVar.name}</code>{copyButton('name')}</div>
      <div className={styles.labels}>
        {typeof envVar.secret === 'boolean' && <span className={styles.label} data-secret={envVar.secret}>{envVar.secret ? 'Secret' : 'Config'}</span>}
        {envVar.required === false && <span className={styles.label}>Optional</span>}
        {envVar.techStackCategory && <span className={styles.category}>{envVar.techStackCategory}</span>}
      </div>
    </div>
    <p className={styles.description}>{envVar.description}</p>
    {envVar.placeholder && <div className={styles.example}>
      <span className={styles.exampleLabel}>Example:</span>
      {policy.hidden ? <span className={styles.withheld}>Sensitive-looking example withheld</span>
        : <code className={styles.exampleValue}>{envVar.placeholder}</code>}
      {policy.canCopy && copyButton('example')}
    </div>}
    <p id={feedbackId} role="status" aria-live="polite" aria-atomic="true"
      className={current ? styles.copyFeedback : 'sr-only'} data-state={current?.state}>
      {current?.state === 'copied' ? current.target === 'name' ? 'Variable name copied.' : 'Example copied.'
        : current?.state === 'failed' ? `Could not copy. Select the ${current.target === 'name' ? 'variable name' : 'example'} and copy it manually.` : ''}
    </p>
  </li>;
}

function EnvVarsContent({ mapId, nodes }: { mapId: string; nodes: MapprSystem['architecture']['nodes'] }) {
  const contentId = useId();
  const [lastAction, setLastAction] = useState<'load' | 'generate' | 'download'>('load');
  const [exportIssue, setExportIssue] = useState<string | null>(null);
  const actionPending = useRef(false);
  const exportEpoch = useRef(0);
  useEffect(() => () => { exportEpoch.current++; }, []);
  // Saved variables remain keyed by the current tech stack + architecture hash.
  const { record, isLoading, isRunning, isDownloading, isWorking, error, downloaded, runGeneration, runDownload } = useGeneratedArtifact({
    mapId, load: getEnvVars, generate: runEnvVars,
    loadError: 'Could not load saved environment variables. Reopen this view to retry, or generate new variables.',
    generationError: 'Something went wrong generating the environment variables.',
    exportError: 'Could not prepare a safe .env.example export.',
  });
  const sections = useMemo(() => record ? groupIntoSections(record.vars, nodes) : [], [record, nodes]);
  const sectionId = (key: string) => contentId + '-service-' + encodeURIComponent(key);

  const handleGenerate = (trigger: HTMLButtonElement) => {
    if (isLoading || isWorking || actionPending.current) return;
    actionPending.current = true;
    exportEpoch.current++;
    setLastAction('generate');
    setExportIssue(null);
    return runGeneration(trigger).finally(() => { actionPending.current = false; });
  };
  const handleDownload = (trigger: HTMLButtonElement) => {
    if (!record || isLoading || isWorking || actionPending.current) return;
    actionPending.current = true;
    const epoch = ++exportEpoch.current;
    setLastAction('download');
    setExportIssue(null);
    const operation = runDownload(trigger, async () => {
      const file = await getEnvVarsFile(mapId);
      try { assertSafeEnvTemplate(file, record.vars); }
      catch (issue) {
        if (epoch === exportEpoch.current && issue instanceof UnsafeEnvExampleError) setExportIssue(issue.message);
        throw issue;
      }
      return { filename: '.env.example', content: file, mimeType: 'text/plain' };
    });
    return Promise.resolve(operation).finally(() => { actionPending.current = false; });
  };
  const displayedError = error && lastAction === 'download' ? exportIssue ?? error : error;

  return <section className={styles.reference} aria-label="Environment variables">
    <header className={styles.header}>
      <div><h2>Environment Variables</h2>
        {record && <p className={styles.summary}>{record.vars.length} variable{record.vars.length === 1 ? '' : 's'} identified</p>}
      </div>
      <div className={styles.actions}>
        {record && <ActionButton compactPending variant="secondary" disabled={isLoading || isWorking}
          onClick={(event) => void handleDownload(event.currentTarget)}
          state={isDownloading ? 'pending' : error && lastAction === 'download' ? 'error' : downloaded ? 'success' : 'idle'}
          idleLabel=".env.example" pendingLabel="Preparing .env.example download" successLabel=".env.example" errorLabel="Retry export"
          icon={<DownloadIcon size={14} weight="bold" />} />}
        <ActionButton compactPending disabled={isLoading || isWorking}
          onClick={(event) => void handleGenerate(event.currentTarget)}
          state={isLoading || isRunning ? 'pending' : error && lastAction === 'generate' ? 'error' : 'idle'}
          idleLabel={record ? 'Regenerate' : 'Generate Variables'} pendingLabel={isLoading ? 'Loading saved environment variables' : 'Generating environment variables'}
          errorLabel="Retry generation" icon={<GearSixIcon size={14} weight="bold" />} />
      </div>
    </header>
    <MotionDisclosure isOpen={Boolean(displayedError)}><p role="alert" className={styles.error}>{displayedError}</p></MotionDisclosure>
    {sections.length > 1 && <nav className={styles.serviceNav} aria-label="Environment variable services">
      <ul>{sections.map((section) => <li key={section.key}>
        <a href={'#' + encodeURIComponent(sectionId(section.key))} onClick={() => document.getElementById(sectionId(section.key))?.focus({ preventScroll: true })}>{section.title}</a>
      </li>)}</ul>
    </nav>}
    <div className={styles.sections}>
      {record?.vars.length === 0 && <p className={styles.empty}>No environment variables were identified. Try regenerating.</p>}
      {!record && !isLoading && !isRunning && !error && <p className={styles.empty}>No variables generated for the current tech stack and architecture yet.</p>}
      {sections.map((section) => <section key={section.key} className={styles.service} aria-labelledby={sectionId(section.key)}>
        <h3 id={sectionId(section.key)} tabIndex={-1} className={styles.serviceHeading}>{section.title}</h3>
        <ul className={styles.variables}>{section.vars.map((envVar, index) => <EnvVarRow key={envVar.name + '-' + index} envVar={envVar} />)}</ul>
      </section>)}
    </div>
    <p role="status" aria-atomic="true" className="sr-only">
      {isLoading ? 'Loading saved environment variables.' : isRunning ? 'Generating environment variables. Existing variables remain available.'
        : isDownloading ? 'Preparing .env.example download.' : downloaded ? '.env.example download prepared.' : ''}
    </p>
  </section>;
}

export function EnvVarsView(props: { mapId: string; nodes: MapprSystem['architecture']['nodes'] }) {
  return <EnvVarsContent key={props.mapId} {...props} />;
}
