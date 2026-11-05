'use client';

import {
  startTransition, useCallback, useDeferredValue, useEffect, useId, useLayoutEffect,
  useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode,
} from 'react';
import {
  ArrowDownIcon, ArrowUpIcon, ArrowsInSimpleIcon, ArrowsOutSimpleIcon, CaretDownIcon,
  CaretRightIcon, CheckIcon, CopyIcon, LinkSimpleIcon, MagnifyingGlassIcon, XIcon,
} from '@phosphor-icons/react';
import { usePreservedViewState } from '@/lib/artifact-workspace';
import {
  ancestorPaths, buildJsonIndex, effectiveOpenPaths, entriesOf, findEntries, initialInspectorState,
  isContainer, jsonValueText, pathsToDepth, reconcileInspectorState, visiblePaths,
  type InspectorState, type JsonContainer as Container, type JsonEntry, type JsonIndex,
} from '@/lib/json-inspector';
import { ActionButton } from './ActionButton';
import styles from './JsonView.module.css';

const PREVIEW_ITEMS = 3;
const PREVIEW_STRING_MAX = 24;

function formatPreviewValue(value: unknown): string {
  if (typeof value === 'string') {
    const text =
      value.length > PREVIEW_STRING_MAX
        ? `${value.slice(0, PREVIEW_STRING_MAX).trimEnd()}…`
        : value;
    return JSON.stringify(text);
  }
  return String(value);
}

function previewOf(container: Container): string | null {
  const entries = entriesOf(container);

  if (Array.isArray(container)) {
    const head = entries.slice(0, PREVIEW_ITEMS);
    if (!head.every(([, value]) => !isContainer(value))) return null;
    const parts = head.map(([, value]) => formatPreviewValue(value));
    if (entries.length > head.length) parts.push('…');
    return `[ ${parts.join(', ')} ]`;
  }

  const shown = entries.filter(([, value]) => !isContainer(value)).slice(0, PREVIEW_ITEMS);
  if (shown.length === 0) return null;
  const parts = shown.map(([key, value]) => `${key}: ${formatPreviewValue(value)}`);
  if (entries.length > shown.length) parts.push('…');
  return `{ ${parts.join(', ')} }`;
}

function summarize(container: Container): string {
  const count = entriesOf(container).length;
  return Array.isArray(container)
    ? `[ ${count} ${count === 1 ? 'item' : 'items'} ]`
    : `{ ${count} ${count === 1 ? 'key' : 'keys'} }`;
}

// ---- Pretty mode ------------------------------------------------------------
// An editor-style view of JSON.stringify(data, null, 2): syntax colours,
// bracket-pair colours by nesting depth, indent guides and line numbers.
// Everything decorative is CSS (see .json-line in globals.css),
// so the text in the DOM is exactly the JSON and selecting, copying or
// searching it never includes line numbers. Built from React text nodes,
// never innerHTML, because the data comes from an API.

const TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],]/g;

const BRACKET_CLASSES = [
  'text-syntax-bracket-1',
  'text-syntax-bracket-2',
  'text-syntax-bracket-3',
];

type PrettyLine = { indent: number; nodes: ReactNode[] };

function colorizeLines(text: string): PrettyLine[] {
  let depth = 0; // bracket nesting, carried across lines

  return text.split('\n').map((line) => {
    const indent = line.length - line.trimStart().length;
    const nodes: ReactNode[] = [];
    let cursor = 0;
    let key = 0;
    const push = (className: string, content: string) => {
      nodes.push(
        <span key={key++} className={className}>
          {content}
        </span>,
      );
    };

    for (const match of line.matchAll(TOKEN)) {
      const start = match.index ?? 0;
      if (start > cursor) nodes.push(line.slice(cursor, start));

      const [token, quoted, colon] = match;
      if (quoted !== undefined) {
        if (colon !== undefined) {
          push('text-syntax-key', quoted);
          push('text-syntax-punct', colon);
        } else {
          push('text-syntax-string', quoted);
        }
      } else if (token === '{' || token === '[') {
        push(BRACKET_CLASSES[depth % BRACKET_CLASSES.length], token);
        depth += 1;
      } else if (token === '}' || token === ']') {
        depth = Math.max(0, depth - 1);
        push(BRACKET_CLASSES[depth % BRACKET_CLASSES.length], token);
      } else if (token === ',') {
        push('text-syntax-punct', token);
      } else if (token === 'null') {
        push('text-syntax-null', token);
      } else if (token === 'true' || token === 'false') {
        push('text-syntax-boolean', token);
      } else {
        push('text-syntax-number', token);
      }
      cursor = start + token.length;
    }

    if (cursor < line.length) nodes.push(line.slice(cursor));
    return { indent, nodes };
  });
}

function PrettyJson({ text }: { text: string }) {
  const lines = useMemo(() => colorizeLines(text), [text]);
  // Gutter wide enough for the last line number.
  const gutter = `${Math.max(String(lines.length).length, 2)}ch`;

  return (
    <div
      className="json-editor whitespace-pre-wrap break-words"
      style={{ '--json-gutter': gutter } as CSSProperties}
    >
      {lines.map((line, index) => (
        <div key={index} className="json-line" style={{ backgroundSize: `${line.indent}ch 100%` }}>
          {line.nodes}
        </div>
      ))}
    </div>
  );
}



function Primitive({ value }: { value: unknown }) {
  const tone = value === null ? 'text-syntax-null' : typeof value === 'string' ? 'text-syntax-string'
    : typeof value === 'boolean' ? 'text-syntax-boolean' : 'text-syntax-number';
  return <span className={tone}>{typeof value === 'string' ? JSON.stringify(value) : String(value)}</span>;
}

type CopyKind = 'path' | 'value';
type CopyFeedback = { source: unknown; target: string; state: 'copied' | 'failed'; message: string };
type CopyNode = (kind: CopyKind, entry: JsonEntry) => void;
const copyTarget = (kind: CopyKind, entry: JsonEntry) => kind + ':' + entry.path;

function CopyProperty({ kind, entry, feedback, onCopy }: {
  kind: CopyKind; entry: JsonEntry; feedback: CopyFeedback | null; onCopy: CopyNode;
}) {
  if (kind === 'value' && entry.value === undefined) return null;
  const result = feedback?.target === copyTarget(kind, entry) ? feedback.state : undefined;
  const label = kind === 'path' ? 'Copy path ' + entry.displayPath : 'Copy JSON value at ' + entry.displayPath;
  return <button type="button" className={styles.smallButton} data-state={result}
    aria-label={label} title={result === 'copied' ? 'Copied' : label} onClick={() => onCopy(kind, entry)}>
    {result === 'copied' ? <CheckIcon size={14} weight="bold" aria-hidden="true" />
      : kind === 'path' ? <LinkSimpleIcon size={14} aria-hidden="true" /> : <CopyIcon size={14} aria-hidden="true" />}
  </button>;
}

function JsonNode({ entry, index, openPaths, selectedPath, matches, activeMatch, feedback, treeId, onToggle, onSelect, onCopy, onNavigate, isLast }: {
  entry: JsonEntry; index: JsonIndex; openPaths: Set<string>; selectedPath: string;
  matches: Set<string>; activeMatch?: string; feedback: CopyFeedback | null; treeId: string;
  onToggle: (path: string) => void; onSelect: (path: string) => void; onCopy: CopyNode;
  onNavigate: (event: KeyboardEvent<HTMLButtonElement>) => void; isLast: boolean;
}) {
  const { value, path } = entry;
  const container = isContainer(value), expandable = entry.children.length > 0;
  const open = expandable && openPaths.has(path);
  const bracket = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  const childrenId = treeId + '-children-' + entry.id;
  const selected = path === selectedPath;
  return <li>
    <div className={styles.row} data-json-id={entry.id} data-selected={selected}
      data-match={matches.has(path)} data-active-match={path === activeMatch}>
      {expandable ? <button type="button" className={styles.chevron} onClick={() => onToggle(path)}
        aria-expanded={open} aria-controls={childrenId} aria-label={(open ? 'Collapse ' : 'Expand ') + entry.displayPath}>
        <CaretRightIcon size={14} weight="bold" aria-hidden="true" data-open={open} />
      </button> : <span className={styles.gutter} aria-hidden="true" />}
      <button type="button" data-json-select={entry.id} className={styles.property} aria-pressed={selected}
        title={entry.displayPath} onFocus={() => onSelect(path)} onClick={() => onSelect(path)} onKeyDown={onNavigate}>
        <span className="sr-only">{entry.displayPath + ': '}</span>
        {entry.name !== undefined && !entry.parentIsArray && <><span className="text-trace">{JSON.stringify(entry.name)}</span><span className={styles.punctuation}>: </span></>}
        {container ? <span className={styles.punctuation}>{open ? bracket[0] : expandable ? previewOf(value) ?? summarize(value) : bracket.join('')}</span>
          : <Primitive value={value} />}
        {!open && !isLast && <span className={styles.punctuation}>,</span>}
      </button>
      <span className={styles.rowCopies} role="group" aria-label={'Copy ' + entry.displayPath}>
        <CopyProperty kind="value" entry={entry} feedback={feedback} onCopy={onCopy} />
        <CopyProperty kind="path" entry={entry} feedback={feedback} onCopy={onCopy} />
      </span>
    </div>
    {expandable && <ul id={childrenId} className={styles.children} hidden={!open}>
      {open && entry.children.map((path, i) => <JsonNode key={path} entry={index.get(path)!}
        index={index} openPaths={openPaths} selectedPath={selectedPath} matches={matches} activeMatch={activeMatch}
        feedback={feedback} treeId={treeId} onToggle={onToggle} onSelect={onSelect} onCopy={onCopy}
        onNavigate={onNavigate} isLast={i === entry.children.length - 1} />)}
    </ul>}
    {open && <div className={styles.closing} aria-hidden="true">{bracket[1]}{isLast ? '' : ','}</div>}
  </li>;
}

function DepthMenu({ onDepth }: { onDepth: (depth: number) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (!ref.current) return;
    ref.current.open = false;
    ref.current.querySelector('summary')?.focus();
  };
  return <details ref={ref} className={styles.depthMenu} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  }}>
    <summary>Expand to level <CaretDownIcon size={12} aria-hidden="true" /></summary>
    <div className={styles.depthOptions} role="group" aria-label="Expansion depth">
      {[2, 3].map((depth) => <button key={depth} type="button" onClick={() => { onDepth(depth); close(); }}>Level {depth}</button>)}
    </div>
  </details>;
}

export function JsonView({ data }: { data: unknown }) {
  const index = useMemo(() => buildJsonIndex(data), [data]);
  const prettyText = useMemo(() => jsonValueText(data), [data]);
  const [saved, setView] = usePreservedViewState<InspectorState>('json:inspector', () => initialInspectorState(data));
  let view = saved;
  if (view.source !== data) {
    view = reconcileInspectorState(view, data, index);
    setView(view);
  }
  const treeId = useId(), findId = treeId + '-find';
  const viewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const [revealRequest, setRevealRequest] = useState(0);
  const deferredQuery = useDeferredValue(view.query);
  const query = view.query.trim() ? deferredQuery : '';
  const results = useMemo(() => findEntries(index, query), [index, query]);
  const matchedPaths = useMemo(() => new Set(results.map((entry) => entry.path)), [results]);
  const activeMatch = results.find((entry) => entry.path === view.matchPath) ?? results[0];
  const activeIndex = activeMatch ? results.indexOf(activeMatch) : -1;
  const revealed = useMemo(() => ancestorPaths(index, activeMatch?.path ?? null), [index, activeMatch]);
  const openPaths = useMemo(() => effectiveOpenPaths(view.manualPaths, revealed, view.searchClosed), [view.manualPaths, revealed, view.searchClosed]);
  const visible = useMemo(() => visiblePaths(index, openPaths), [index, openPaths]);
  const selected = index.get(view.selectedPath) ?? index.get('')!;
  const [storedFeedback, setFeedback] = useState<CopyFeedback | null>(null);
  const feedback = storedFeedback?.source === data ? storedFeedback : null;
  const copyRequest = useRef(0), resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    copyRequest.current++;
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
  }, [data]);

  const copy = useCallback(async (target: string, text: () => string, description: string) => {
    const request = ++copyRequest.current;
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(text());
      if (request !== copyRequest.current) return;
      setFeedback({ source: data, target, state: 'copied', message: description + ' copied.' });
      resetTimer.current = setTimeout(() => { if (request === copyRequest.current) setFeedback(null); }, 1500);
    } catch {
      if (request === copyRequest.current) setFeedback({ source: data, target, state: 'failed', message: 'Could not copy ' + description.toLowerCase() + '. Try again.' });
    }
  }, [data]);
  const copyNode: CopyNode = (kind, entry) => void copy(copyTarget(kind, entry),
    () => kind === 'path' ? entry.displayPath : jsonValueText(entry.value), kind === 'path' ? 'Path' : 'Value');

  useLayoutEffect(() => {
    if (view.mode !== 'tree' || !query.trim() || !activeMatch) return;
    const viewport = viewportRef.current;
    const row = viewport?.querySelector<HTMLElement>('[data-json-id="' + activeMatch.id + '"]');
    if (!viewport || !row) return;
    const bounds = viewport.getBoundingClientRect(), target = row.getBoundingClientRect();
    const top = target.top < bounds.top + 4 ? target.top - bounds.top - 4
      : target.bottom > bounds.bottom - 4 ? target.bottom - bounds.bottom + 4 : 0;
    if (top) viewport.scrollBy({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [view.mode, query, activeMatch, revealRequest]);

  const select = useCallback((path: string) => setView((current) => current.selectedPath === path ? current : { ...current, selectedPath: path }), [setView]);
  const toggle = (path: string) => setView((current) => {
    const manualPaths = new Set(current.manualPaths), searchClosed = new Set(current.searchClosed);
    const open = !current.searchClosed.has(path) && (current.manualPaths.has(path) || revealed.has(path));
    if (open) {
      manualPaths.delete(path);
      if (revealed.has(path)) searchClosed.add(path);
    } else { manualPaths.add(path); searchClosed.delete(path); }
    return { ...current, manualPaths, searchClosed };
  });
  const openToDepth = (depth: number) => {
    const paths = pathsToDepth(index, depth);
    startTransition(() => setView((current) => ({ ...current, manualPaths: paths,
      searchClosed: new Set(Array.from(revealed).filter((path) => !paths.has(path))) })));
  };
  const changeQuery = (query: string) => setView((current) => ({
    ...current, query, matchPath: query.trim() ? current.matchPath : null, searchClosed: new Set(),
  }));
  const advance = (direction: number) => {
    if (!results.length) return;
    setView((current) => {
      const at = Math.max(0, results.findIndex((entry) => entry.path === current.matchPath));
      return { ...current, matchPath: results[(at + direction + results.length) % results.length].path, searchClosed: new Set() };
    });
    setRevealRequest((request) => request + 1);
  };
  const closeFind = () => {
    setView((current) => ({ ...current, mobileFindOpen: false }));
    searchToggleRef.current?.focus({ preventScroll: true });
  };
  const navigate = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(viewportRef.current?.querySelectorAll<HTMLButtonElement>('[data-json-select]') ?? []);
    const current = buttons.indexOf(event.currentTarget);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : Math.min(buttons.length - 1, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)));
    event.preventDefault();
    buttons[next]?.focus();
  };
  const copyAllState = feedback?.target === 'whole' ? feedback.state === 'copied' ? 'success' : 'error' : 'idle';

  return <section className={styles.inspector} aria-label="JSON Inspector">
    <div className={styles.toolbar}>
      <div className={styles.mainControls}>
        <div className={styles.modes} role="group" aria-label="JSON view mode">
          {(['tree', 'pretty'] as const).map((mode) => <button key={mode} type="button" aria-pressed={view.mode === mode}
            onClick={() => setView((current) => ({ ...current, mode, mobileFindOpen: mode === 'tree' && current.mobileFindOpen }))}>
            {mode === 'tree' ? 'Tree' : 'Pretty'}
          </button>)}
        </div>
        <button ref={searchToggleRef} type="button" className={styles.searchToggle} disabled={view.mode !== 'tree'}
          aria-expanded={view.mobileFindOpen} aria-controls={findId} data-active={Boolean(view.query.trim())}
          aria-label={'Find in Tree' + (view.query.trim() ? ', saved query: ' + view.query : '')} title="Find in Tree"
          onClick={() => {
            setView((current) => ({ ...current, mobileFindOpen: true }));
            requestAnimationFrame(() => inputRef.current?.focus());
          }}><MagnifyingGlassIcon size={16} aria-hidden="true" /></button>
        <div id={findId} className={styles.find} data-mobile-open={view.mobileFindOpen}>
          <MagnifyingGlassIcon size={14} aria-hidden="true" />
          <input ref={inputRef} type="search" value={view.query} disabled={view.mode !== 'tree'}
            aria-label="Find keys and values in Tree mode" placeholder="Find in Tree" autoComplete="off" spellCheck={false}
            onChange={(event) => changeQuery(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); advance(event.shiftKey ? -1 : 1); }
              if (event.key === 'Escape' && searchToggleRef.current?.getClientRects().length) { event.preventDefault(); closeFind(); }
            }} />
          {view.query && <button type="button" className={styles.clearFind} onClick={() => changeQuery('')}>Clear</button>}
          <button type="button" className={styles.closeFind} aria-label="Close Find, keep query" title="Close Find" onClick={closeFind}><XIcon size={14} aria-hidden="true" /></button>
        </div>
        <ActionButton compactPending variant="secondary" className={styles.copyAll} title="Copy complete JSON"
          state={copyAllState} idleLabel="Copy JSON" pendingLabel="Copy JSON" successLabel="Copied" errorLabel="Retry copy"
          icon={<CopyIcon size={14} aria-hidden="true" />} onClick={() => void copy('whole', () => prettyText, 'JSON')} />
      </div>
      {view.mode === 'tree' ? <div className={styles.treeControls}>
        <div className={styles.expansionControls}>
          <button type="button" className={styles.secondary} onClick={() => openToDepth(Infinity)} title="Expand all" aria-label="Expand all"><ArrowsOutSimpleIcon size={14} aria-hidden="true" /><span>Expand all</span></button>
          <button type="button" className={styles.secondary} onClick={() => openToDepth(1)} title="Collapse all (root stays open)" aria-label="Collapse all"><ArrowsInSimpleIcon size={14} aria-hidden="true" /><span>Collapse all</span></button>
          <DepthMenu onDepth={openToDepth} />
        </div>
        {view.query.trim() && <div className={styles.matchControls}>
          <output aria-live="polite" aria-atomic="true" aria-label={'Tree results for ' + query}>{results.length ? `${activeIndex + 1} / ${results.length} matches` : 'No matches'}</output>
          <button type="button" className={styles.smallButton} disabled={!results.length} title="Previous match" aria-label="Previous match" onClick={() => advance(-1)}><ArrowUpIcon size={14} aria-hidden="true" /></button>
          <button type="button" className={styles.smallButton} disabled={!results.length} title="Next match" aria-label="Next match" onClick={() => advance(1)}><ArrowDownIcon size={14} aria-hidden="true" /></button>
        </div>}
      </div> : <p className={styles.scope}>Find is available in Tree mode.</p>}
    </div>
    {view.mode === 'tree' && <div className={styles.pathRow}>
      <span className={styles.pathLabel}>Path</span><code aria-label="Selected JSON path">{selected.displayPath}</code>
      {!visible.has(selected.path) && <span className={styles.hiddenSelection}>In a collapsed branch</span>}
      <span className={styles.pathCopies} role="group" aria-label="Copy selected property">
        <CopyProperty kind="value" entry={selected} feedback={feedback} onCopy={copyNode} />
        <CopyProperty kind="path" entry={selected} feedback={feedback} onCopy={copyNode} />
      </span>
    </div>}
    {feedback && <p role="status" className={styles.copyFeedback} data-state={feedback.state}>{feedback.message}</p>}
    <p className="sr-only">In Tree mode, use Tab for property and expansion controls. Up and Down move between properties. Enter or Space selects a property; its separate chevron controls expansion.</p>
    <div key={view.mode} ref={viewportRef} className={styles.viewport} data-mode={view.mode}
      {...(view.mode === 'pretty' ? { tabIndex: 0, role: 'region', 'aria-label': 'Pretty-printed JSON' } : {})}>
      {view.mode === 'tree' ? <ul className={styles.tree} aria-label="JSON properties">
        <JsonNode entry={index.get('')!} index={index} openPaths={openPaths} selectedPath={selected.path}
          matches={matchedPaths} activeMatch={activeMatch?.path} feedback={feedback} treeId={treeId}
          onToggle={toggle} onSelect={select} onCopy={copyNode} onNavigate={navigate} isLast />
      </ul> : <PrettyJson text={prettyText} />}
    </div>
  </section>;
}
