'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { CaretRightIcon, CheckIcon, CopyIcon, WarningIcon } from '@phosphor-icons/react';

// Motion for this view (see the Mappr motion brief, "JSON"):
//   Expand / Collapse -> the caret rotates, `fast` + standard easing.
//   Children mount/unmount immediately: no fade, no height animation, no
//   stagger. Nothing here is a genuine layout change, and the rotating
//   caret already communicates the state change.
//   Reduced motion -> the rotation is dropped (immediate state change).
// Expansion state is view state only; the data stays the single source of
// truth and is never copied.
//
// Two modes with different jobs: Tree is a navigator (carets, previews,
// depth); Pretty is an editor-style read-only view (syntax palette, bracket
// colours, line numbers, indent guides) with its own --color-syntax-* tokens.
//
// Toolbar: Tree / Pretty modes, depth buttons (Tree only) and Copy JSON.
//   Switching mode is an instant swap — the pressed state is the feedback,
//   and nothing moves spatially. Copy shows "Copied" only after the
//   clipboard write has actually succeeded (never optimistically), and a
//   failure stays visible until the next attempt. Neither adds motion.
//
// Formatting follows a JSON file: quoted keys, a space after each colon,
// trailing commas (none after the last item), closing brackets on their
// own line, 24px indent per level with a guide line under the caret.
// Array indexes are not shown (a JSON file doesn't show them); the
// assistive-tech labels still say "item N".

type Container = Record<string, unknown> | unknown[];

function isContainer(value: unknown): value is Container {
  return typeof value === 'object' && value !== null;
}

function entriesOf(container: Container): [string, unknown][] {
  return Array.isArray(container)
    ? container.map((item, index) => [String(index), item])
    : Object.entries(container);
}

// Paths are built from encoded keys so a key containing the separator
// can't collide with a nested path. The root is the empty string.
function childPath(parent: string, key: string): string {
  return `${parent}/${encodeURIComponent(key)}`;
}

// Container paths to open for a given depth: containers at depth < maxDepth
// (the root is depth 0). maxDepth 1 = root only (default / "Collapse all"),
// 2 = root + each section, Infinity = everything ("Expand all").
function collectPathsToDepth(
  value: unknown,
  path: string,
  depth: number,
  maxDepth: number,
  into: string[],
): string[] {
  if (!isContainer(value) || depth >= maxDepth) return into;
  const entries = entriesOf(value);
  if (entries.length === 0) return into;
  into.push(path);
  for (const [key, child] of entries) {
    collectPathsToDepth(child, childPath(path, key), depth + 1, maxDepth, into);
  }
  return into;
}

// ---- Collapsed previews -------------------------------------------------
// A collapsed node shows a peek at its leading primitive values, e.g.
// { id: "f1", name: "Login", … }, so a list of objects is identifiable
// without opening each one. Nodes with nothing primitive to show fall
// back to a count, e.g. [ 12 items ].

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

// ---- Rendering ------------------------------------------------------------

function Primitive({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <span className="text-text">{JSON.stringify(value)}</span>;
  }
  if (value === null) {
    return <span className="text-text-muted">null</span>;
  }
  return <span className="text-signal">{String(value)}</span>;
}

// One line of the document: a 20px lead column (caret or empty gutter)
// then the content. Collapsed rows stay on a single truncated line;
// everything else wraps like text in a file.
function Row({
  lead,
  truncate = false,
  children,
}: {
  lead: ReactNode;
  truncate?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start">
      {lead}
      <div className={`min-w-0 flex-1 pl-1 ${truncate ? 'truncate' : 'break-words'}`}>
        {children}
      </div>
    </div>
  );
}

type JsonNodeProps = {
  name?: string;
  parentIsArray?: boolean;
  value: unknown;
  path: string;
  isLast: boolean;
  openPaths: Set<string>;
  onToggle: (path: string) => void;
};

function JsonNode({ name, parentIsArray, value, path, isLast, openPaths, onToggle }: JsonNodeProps) {
  // Array items have no key in a JSON file, so no label is drawn for them.
  const keyLabel =
    name === undefined || parentIsArray ? null : (
      <>
        <span className="text-trace">{JSON.stringify(name)}</span>
        <span className="text-text-muted">:</span>{' '}
      </>
    );

  const comma = isLast ? null : <span className="text-text-muted">,</span>;
  const gutter = <span className="w-5 shrink-0" aria-hidden="true" />;

  if (!isContainer(value)) {
    return (
      <Row lead={gutter}>
        {keyLabel}
        <Primitive value={value} />
        {comma}
      </Row>
    );
  }

  const entries = entriesOf(value);
  const isArray = Array.isArray(value);
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  if (entries.length === 0) {
    return (
      <Row lead={gutter}>
        {keyLabel}
        <span className="text-text-muted">
          {openBracket}
          {closeBracket}
        </span>
        {comma}
      </Row>
    );
  }

  const isOpen = openPaths.has(path);
  const subject = name === undefined ? 'root' : parentIsArray ? `item ${name}` : name;

  const caret = (
    <button
      type="button"
      onClick={() => onToggle(path)}
      aria-expanded={isOpen}
      aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${subject}`}
      className="flex h-6 w-5 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:text-text"
    >
      <CaretRightIcon
        size={14}
        weight="bold"
        className={`transition-transform duration-(--motion-fast) ease-standard motion-reduce:transition-none ${
          isOpen ? 'rotate-90' : ''
        }`}
      />
    </button>
  );

  return (
    <div>
      <Row lead={caret} truncate={!isOpen}>
        {keyLabel}
        {isOpen ? (
          <span className="text-text-muted">{openBracket}</span>
        ) : (
          <>
            <span className="text-text-muted">{previewOf(value) ?? summarize(value)}</span>
            {comma}
          </>
        )}
      </Row>

      {isOpen && (
        <>
          {/* 10px margin + 1px guide + 13px padding = 24px per level; the
              guide sits under the centre of the parent's caret. */}
          <div className="ml-2.5 border-l border-text-muted/25 pl-[13px]">
            {entries.map(([key, child], index) => (
              <JsonNode
                key={key}
                name={key}
                parentIsArray={isArray}
                value={child}
                path={childPath(path, key)}
                isLast={index === entries.length - 1}
                openPaths={openPaths}
                onToggle={onToggle}
              />
            ))}
          </div>
          <Row lead={gutter}>
            <span className="text-text-muted">{closeBracket}</span>
            {comma}
          </Row>
        </>
      )}
    </div>
  );
}

type Mode = 'tree' | 'pretty';
type CopyState = 'idle' | 'copied' | 'failed';

const MODES: { id: Mode; label: string }[] = [
  { id: 'tree', label: 'Tree' },
  { id: 'pretty', label: 'Pretty' },
];

const COPIED_RESET_MS = 1500;

const TOOLBAR_BUTTON_BASE =
  'rounded-full border border-canvas-grid px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors';
const TOOLBAR_BUTTON = `${TOOLBAR_BUTTON_BASE} text-text-muted hover:bg-surface-raised hover:text-text`;

export function JsonView({ data }: { data: unknown }) {
  const [mode, setMode] = useState<Mode>('tree');
  // Default: root open one level, everything beneath it collapsed — the
  // full document is long, so the structure should read at a glance.
  const [openPaths, setOpenPaths] = useState<Set<string>>(() => new Set(['']));
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<number | null>(null);

  const prettyText = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const handleToggle = useCallback((path: string) => {
    setOpenPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Depth buttons are plain state changes: no fade, no stagger.
  const openToDepth = useCallback(
    (maxDepth: number) => setOpenPaths(new Set(collectPathsToDepth(data, '', 0, maxDepth, []))),
    [data],
  );

  const clearResetTimer = useCallback(() => {
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  }, []);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  const handleCopy = useCallback(async () => {
    clearResetTimer();
    try {
      await navigator.clipboard.writeText(prettyText);
      setCopyState('copied');
      resetTimer.current = window.setTimeout(() => {
        resetTimer.current = null;
        setCopyState('idle');
      }, COPIED_RESET_MS);
    } catch {
      // Blocked or unavailable (the clipboard API needs HTTPS or localhost).
      // Stays visible until the next attempt.
      setCopyState('failed');
    }
  }, [prettyText, clearResetTimer]);

  const copyClass =
    copyState === 'idle'
      ? TOOLBAR_BUTTON
      : `${TOOLBAR_BUTTON_BASE} hover:bg-surface-raised ${
          copyState === 'copied' ? 'text-success' : 'text-danger'
        }`;

  return (
    <div className="flex flex-col rounded-lg bg-surface-raised">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-canvas-grid px-6 py-3">
        <div
          role="group"
          aria-label="View mode"
          className="flex rounded-full border border-canvas-grid p-0.5"
        >
          {MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
              className={`rounded-full px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors ${
                mode === id ? 'bg-canvas text-trace' : 'text-text-muted hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'tree' && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => openToDepth(1)} className={TOOLBAR_BUTTON}>
              Collapse all
            </button>
            <button type="button" onClick={() => openToDepth(2)} className={TOOLBAR_BUTTON}>
              Level 2
            </button>
            <button type="button" onClick={() => openToDepth(3)} className={TOOLBAR_BUTTON}>
              Level 3
            </button>
            <button
              type="button"
              onClick={() => openToDepth(Number.POSITIVE_INFINITY)}
              className={TOOLBAR_BUTTON}
            >
              Expand all
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleCopy}
          className={`${copyClass} ml-auto flex min-w-40 items-center justify-center gap-2`}
        >
          {copyState === 'copied' ? (
            <CheckIcon size={14} weight="bold" aria-hidden="true" />
          ) : copyState === 'failed' ? (
            <WarningIcon size={14} weight="bold" aria-hidden="true" />
          ) : (
            <CopyIcon size={14} aria-hidden="true" />
          )}
          {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? "Couldn't copy" : 'Copy JSON'}
        </button>

        <span role="status" aria-live="polite" className="sr-only">
          {copyState === 'copied'
            ? 'JSON copied to clipboard'
            : copyState === 'failed'
              ? 'Could not copy JSON'
              : ''}
        </span>
      </div>

      {/* Keyed by mode so switching starts at the top; the tree's open state
          lives above, so it survives a trip to Pretty and back. */}
      <div
        key={mode}
        {...(mode === 'pretty'
          ? { tabIndex: 0, role: 'region', 'aria-label': 'Pretty-printed JSON' }
          : {})}
        className={`max-h-[600px] overflow-auto rounded-b-lg p-6 font-mono text-sm leading-6 ${
          mode === 'pretty' ? 'bg-surface' : ''
        }`}
      >
        {mode === 'tree' ? (
          <JsonNode value={data} path="" isLast openPaths={openPaths} onToggle={handleToggle} />
        ) : (
          <PrettyJson text={prettyText} />
        )}
      </div>
    </div>
  );
}