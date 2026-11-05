'use client';

import { useLayoutEffect, useRef, useState, type Ref } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, BookOpenTextIcon, CheckIcon } from '@phosphor-icons/react';
import type { Adr, AdrSetRecord } from '@/lib/api';
import { getAdrs, getAdrsMarkdown, runAdrs } from '@/lib/api';
import { useGeneratedArtifact } from '@/lib/use-generated-artifact';
import { usePreservedViewState } from '@/lib/artifact-workspace';
import { ArtifactActionButton, ArtifactActions } from './ArtifactActions';
import { MotionDisclosure } from './MotionDisclosure';
import styles from './AdrView.module.css';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function field(record: object, name: string): unknown {
  return (record as Record<string, unknown>)[name];
}

function textField(record: object, name: string): string | undefined {
  const value = field(record, name);
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function subjectLabel(adr: Adr): string {
  switch (adr.subjectType) {
    case 'tech_stack': return 'Tech stack';
    case 'architecture_node': return 'Architecture node';
    case 'architecture_edge': return 'Architecture connection';
    default: return adr.subjectType;
  }
}

function decisionPreview(adr: Adr): string {
  const text = (textField(adr, 'summary') ?? adr.decision).replace(/\s+/g, ' ').trim();
  const characters = Array.from(text);
  return characters.length > 200 ? `${characters.slice(0, 200).join('')}…` : text;
}

// Prefer a real record ID if supplied. The current contract identifies subjects
// by type + ID; never treat an array position as a durable decision identity.
function recordId(adr: Adr): string | undefined {
  const id = field(adr, 'id');
  if (typeof id === 'string' && id.trim()) return `string:${id}`;
  if (typeof id === 'number' && Number.isFinite(id)) return `number:${id}`;
}

function matchingDecision(previous: Adr, adrs: Adr[]): Adr | null {
  if (adrs.includes(previous)) return previous;
  const id = recordId(previous);
  const matches = id !== undefined
    ? adrs.filter((adr) => recordId(adr) === id)
    : adrs.filter((adr) => adr.subjectType === previous.subjectType && adr.subjectId === previous.subjectId);
  if (matches.length === 1) return matches[0];
  if (id !== undefined) return null;
  const sameTitle = matches.filter((adr) => adr.title === previous.title);
  return sameTitle.length === 1 ? sameTitle[0] : null;
}

function Status({ adr, id }: { adr: Adr; id?: string }) {
  const status = textField(adr, 'status');
  if (!status) return null;
  const normalized = status.trim().toLowerCase();
  const tone = normalized === 'accepted' ? 'positive' : normalized === 'rejected' ? 'negative' : normalized === 'proposed' ? 'informative' : 'neutral';
  return <span id={id} className={styles.status} data-tone={tone}>
    {normalized === 'accepted' && <CheckIcon size={12} weight="bold" className={styles.statusIcon} aria-hidden="true" />}
    {status}
  </span>;
}

// Keep any real additional metadata readable without changing the API model.
function Metadata({ record, exclude }: { record: object; exclude: string[] }) {
  const entries = Object.entries(record).filter(([name, value]) =>
    !exclude.includes(name) && value !== undefined && value !== null && value !== '');
  if (!entries.length) return null;
  return <dl className={styles.metadata}>
    {entries.map(([name, value]) => <div key={name}>
      <dt>{name}</dt>
      <dd>{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</dd>
    </div>)}
  </dl>;
}

function DecisionReader({ adr, headingRef, onBack }: {
  adr: Adr;
  headingRef: Ref<HTMLHeadingElement>;
  onBack: () => void;
}) {
  return <div className={styles.reader}>
    <button type="button" className={styles.back} onClick={onBack}>
      <ArrowLeftIcon size={16} aria-hidden="true" /> Back to all decisions
    </button>
    <article className={styles.document} aria-labelledby="adr-reader-title">
      <header className={styles.documentHeader}>
        <div className={styles.titleLine}>
          <h3 id="adr-reader-title" tabIndex={-1} ref={headingRef}>{adr.title}</h3>
          <Status adr={adr} />
        </div>
        <div className={styles.context}>
          <span>{subjectLabel(adr)}</span><span className={styles.subjectId}>{adr.subjectId}</span>
        </div>
      </header>
      {adr.decision && <section className={styles.decision} aria-labelledby="adr-decision-heading">
        <h4 id="adr-decision-heading">Decision</h4><p>{adr.decision}</p>
      </section>}
      {adr.context && <section className={styles.documentSection} aria-labelledby="adr-context-heading">
        <h4 id="adr-context-heading">Context</h4><p>{adr.context}</p>
      </section>}
      {adr.alternatives.length > 0 && <section className={styles.documentSection} aria-labelledby="adr-alternatives-heading">
        <h4 id="adr-alternatives-heading">Alternatives considered</h4>
        <ul className={styles.alternatives}>
          {adr.alternatives.map((alternative, index) => <li key={`${alternative.option}:${index}`}>
            {alternative.option && <h5>{alternative.option}</h5>}
            {alternative.reasonRejected && <p>{alternative.reasonRejected}</p>}
            <Metadata record={alternative} exclude={['option', 'reasonRejected']} />
          </li>)}
        </ul>
      </section>}
      {adr.consequences.length > 0 && <section className={styles.documentSection} aria-labelledby="adr-consequences-heading">
        <h4 id="adr-consequences-heading">Consequences</h4>
        <ul className={styles.consequences}>{adr.consequences.map((consequence, index) => <li key={index}>{consequence}</li>)}</ul>
      </section>}
      <Metadata record={adr} exclude={['title', 'subjectType', 'subjectId', 'context', 'decision', 'alternatives', 'consequences', ...(textField(adr, 'status') ? ['status'] : [])]} />
    </article>
  </div>;
}

function AdrContent({ mapId, productName }: { mapId: string; productName: string }) {
  // Saved ADRs belong to the current tech stack + architecture hash, not map version.
  const {
    record, isLoading, isRunning, isDownloading, isReloading, isWorking, error,
    downloaded, runGeneration, runDownload, runReload,
  } = useGeneratedArtifact({
    mapId, load: getAdrs, generate: runAdrs,
    loadError: 'Could not load saved ADRs. Retry loading to retrieve them.',
    generationError: 'Something went wrong generating the ADRs.',
    exportError: 'Something went wrong rendering the Markdown.',
  });
  const [view, setView] = useState<{ source: AdrSetRecord | null; selected: Adr | null; notice: string | null }>({ source: record, selected: null, notice: null });
  const [lastAction, setLastAction] = usePreservedViewState<'load' | 'generate' | 'download'>('AdrView:last-action', 'load');
  const libraryRef = useRef<HTMLDivElement>(null);
  const libraryHeadingRef = useRef<HTMLHeadingElement>(null);
  const readerHeadingRef = useRef<HTMLHeadingElement>(null);
  const originRef = useRef<{ adr: Adr; scrollY: number } | null>(null);
  const focusIntent = useRef<'reader' | 'library' | null>(null);

  // Reconcile before rendering: a refreshed reader always uses the new object,
  // and a removed/ambiguous record returns safely to the current library.
  let currentView = view;
  if (view.source !== record) {
    const selected = view.selected && record ? matchingDecision(view.selected, record.adrs) : null;
    currentView = { source: record, selected, notice: view.selected && !selected ? 'The selected decision is no longer available. All current decisions are shown.' : null };
    setView(currentView);
  }
  const { selected, notice } = currentView;

  useLayoutEffect(() => {
    const intent = focusIntent.current;
    if (!intent) return;
    focusIntent.current = null;
    let target: HTMLElement | null = readerHeadingRef.current;
    if (intent === 'library') {
      const origin = originRef.current;
      const match = origin && record ? matchingDecision(origin.adr, record.adrs) : null;
      const index = match && record ? record.adrs.indexOf(match) : -1;
      target = libraryRef.current?.querySelector<HTMLButtonElement>(`[data-adr-index="${index}"]`) ?? libraryHeadingRef.current;
      if (origin) window.scrollTo({ top: origin.scrollY, behavior: 'instant' });
    }
    target ??= libraryHeadingRef.current;
    target?.focus({ preventScroll: true });
    const bounds = target?.getBoundingClientRect();
    if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) {
      target?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }, [record, selected]);

  const openDecision = (adr: Adr) => {
    originRef.current = { adr, scrollY: window.scrollY };
    focusIntent.current = 'reader';
    setView({ source: record, selected: adr, notice: null });
  };
  const backToLibrary = () => {
    focusIntent.current = 'library';
    setView({ source: record, selected: null, notice: null });
  };
  const handleGenerate = (trigger: HTMLButtonElement) => {
    if (isLoading || isWorking) return;
    if (error && lastAction === 'load') return runReload(trigger);
    setLastAction('generate');
    return runGeneration(trigger);
  };
  const handleDownload = (trigger: HTMLButtonElement) => {
    if (!record || isLoading || isWorking) return;
    setLastAction('download');
    return runDownload(trigger, async () => ({
      filename: `${slugify(productName) || 'mappr-export'}-adrs.md`,
      content: await getAdrsMarkdown(mapId), mimeType: 'text/markdown',
    }));
  };

  const occurrences = new Map<string, number>();
  const entries = record?.adrs.map((adr, index) => {
    const identity = recordId(adr) ?? JSON.stringify([adr.subjectType, adr.subjectId, adr.title]);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return { adr, index, key: JSON.stringify([identity, occurrence]) };
  }) ?? [];
  const groups = [
    { title: 'Tech Stack Decisions', entries: entries.filter(({ adr }) => adr.subjectType === 'tech_stack') },
    { title: 'Architecture Decisions', entries: entries.filter(({ adr }) => adr.subjectType !== 'tech_stack') },
  ];
  const primaryPending = isLoading || isRunning || isReloading;
  const actionLabel = record ? 'Regenerate' : 'Generate ADRs';

  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div className={styles.headingCopy}>
        <h2 ref={libraryHeadingRef} tabIndex={-1} className={styles.heading}>Decision library</h2>
        <p className={styles.summary}>{record
          ? `${record.adrs.length} decision${record.adrs.length === 1 ? '' : 's'} · Architecture Decision Records`
          : 'Architecture Decision Records'}</p>
      </div>
      <ArtifactActions>
        {record && <ArtifactActionButton action="export" variant="secondary" title="Export ADR Markdown"
          state={isDownloading ? 'pending' : error && lastAction === 'download' ? 'error' : downloaded ? 'success' : 'idle'}
          aria-label={isDownloading ? 'Preparing Markdown download' : undefined}
          idleLabel="Markdown export" pendingLabel="Preparing Markdown download" successLabel="Download again" errorLabel="Retry export"
           disabled={isLoading || isWorking}
          onClick={(event) => void handleDownload(event.currentTarget)} />}
        <ArtifactActionButton action="generate" regenerate={Boolean(record)}
          title={record ? 'Regenerate ADRs' : 'Generate ADRs'}
          state={primaryPending ? 'pending' : error && lastAction !== 'download' ? 'error' : 'idle'}
          idleLabel={actionLabel} pendingLabel={isLoading || isReloading ? 'Loading saved decisions' : 'Generating decision records'}
          errorLabel={lastAction === 'load' ? 'Retry loading' : 'Retry generation'}
          icon={<BookOpenTextIcon size={14} weight="bold" />}
          disabled={isWorking || isLoading}
          onClick={(event) => void handleGenerate(event.currentTarget)} />
      </ArtifactActions>
    </header>
    <p role="status" aria-atomic="true" className="sr-only">{primaryPending ? 'Decision request in progress.' : isDownloading ? 'Preparing Markdown download.' : downloaded ? 'Markdown download prepared.' : record ? `${record.adrs.length} decisions available.` : ''}</p>
    <MotionDisclosure isOpen={Boolean(error)}>
      <p role="alert" className={styles.error}>{error}</p>
    </MotionDisclosure>
    {notice && <p role="status" className={styles.summary}>{notice}</p>}
    {selected ? <DecisionReader adr={selected} headingRef={readerHeadingRef} onBack={backToLibrary} />
      : <div ref={libraryRef} className={styles.library} role="region" aria-label="Decision library">
        {!record && !primaryPending && !error && <p className={styles.empty}>No decisions generated for the current tech stack and architecture yet.</p>}
        {record?.adrs.length === 0 && <p className={styles.empty}>No decisions were returned for the current tech stack and architecture.</p>}
        {groups.filter((group) => group.entries.length).map((group) => <section className={styles.group} key={group.title} aria-label={group.title}>
          <h3 className={styles.groupHeading}>{group.title}</h3>
          <ul>
            {group.entries.map(({ adr, index, key }) => <li key={key}>
              <button type="button" className={styles.row} data-adr-index={index} onClick={() => openDecision(adr)}
                aria-labelledby={`adr-title-${index}`} aria-describedby={`adr-preview-${index} adr-meta-${index}${textField(adr, 'status') ? ` adr-status-${index}` : ''}`}>
                <span className={styles.rowContent}>
                  <span className={styles.titleLine}>
                    <span className={styles.rowTitle} id={`adr-title-${index}`}>{adr.title}</span>
                    <Status adr={adr} id={`adr-status-${index}`} />
                  </span>
                  <span className={styles.context} id={`adr-meta-${index}`}>
                    <span>{textField(adr, 'category') ?? subjectLabel(adr)}</span><span className={styles.subjectId}>{adr.subjectId}</span>
                  </span>
                  <span className={styles.preview} id={`adr-preview-${index}`}>{decisionPreview(adr)}</span>
                </span>
                <ArrowRightIcon className={styles.arrow} size={16} aria-hidden="true" />
              </button>
            </li>)}
          </ul>
        </section>)}
      </div>}
  </div>;
}

export function AdrView(props: { mapId: string; productName: string }) {
  return <AdrContent key={props.mapId} {...props} />;
}
