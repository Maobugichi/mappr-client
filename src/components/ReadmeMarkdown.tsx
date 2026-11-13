import ReactMarkdown from 'react-markdown';
import { memo, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CheckIcon, CopyIcon, WarningIcon } from '@phosphor-icons/react';
import type { Components } from 'react-markdown';
import type { Nodes, Root } from 'mdast';
import type { Plugin } from 'unified';
import type { ReadmeDocument } from '@/lib/readme-markdown';
import styles from './ReadmeView.module.css';
import { useArtifactSafety } from './ArtifactSafety';

const preparedTree: Plugin<[Root], Root> = (tree) => () => tree;

function ReadmeCodeBlock({ text, children }: { text: string; children: ReactNode }) {
  const safety = useArtifactSafety();
  const blockId = useId();
  const [result, setResult] = useState<{ text: string; state: 'copied' | 'failed' } | null>(null);
  const state = result?.text === text ? result.state : 'idle';
  const pending = useRef(false);
  const request = useRef(0);
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    request.current++;
    pending.current = false;
    window.clearTimeout(resetTimer.current);
  }, [text]);

  const copy = async () => {
    if (pending.current || !safety?.canExport) return;
    pending.current = true;
    const currentRequest = ++request.current;
    window.clearTimeout(resetTimer.current);
    setResult(null);
    try {
      await safety.verifyCopy();
      await navigator.clipboard.writeText(text);
      if (currentRequest !== request.current) return;
      setResult({ text, state: 'copied' });
      resetTimer.current = window.setTimeout(() => {
        resetTimer.current = undefined;
        setResult(null);
      }, 2000);
    } catch {
      if (currentRequest === request.current) setResult({ text, state: 'failed' });
    } finally {
      if (currentRequest === request.current) pending.current = false;
    }
  };

  return <div className={styles.codeBlock}>
    <button type="button" className={styles.codeCopyButton} data-state={state}
      disabled={!safety?.canExport} aria-describedby={!safety?.canExport ? safety?.descriptionId : undefined}
      aria-label={state === 'failed' ? 'Retry copying code block' : 'Copy code block'}
      aria-controls={blockId + '-code'} aria-details={state === 'failed' ? blockId + '-copy-status' : undefined}
      title={state === 'copied' ? 'Copied' : state === 'failed' ? 'Retry copying' : 'Copy code'}
      onClick={() => void copy()}>
      {state === 'copied' ? <CheckIcon size={14} weight="bold" aria-hidden="true" />
        : state === 'failed' ? <WarningIcon size={14} aria-hidden="true" /> : <CopyIcon size={14} aria-hidden="true" />}
    </button>
    <pre id={blockId + '-code'} tabIndex={0} aria-label="Code block">{children}</pre>
    <p id={blockId + '-copy-status'} role="status" aria-live="polite" aria-atomic="true"
      className={state === 'failed' ? styles.codeCopyError : styles.codeCopyFeedback}>
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not verify or copy this content. Refresh current output and retry.' : ''}
    </p>
  </div>;
}

export const ReadmeMarkdown = memo(function ReadmeMarkdown({ document }: { document: ReadmeDocument }) {
  const codeValues = new Map<number, string>();
  const collectCode = (node: Nodes) => {
    if (node.type === 'code' && node.position?.start.offset !== undefined) codeValues.set(node.position.start.offset, node.value);
    if ('children' in node) node.children.forEach(collectCode);
  };
  collectCode(document.tree);

  const components: Components = {
    pre: ({ children, node }) => {
      const renderedText = node?.children.map((child) => child.type === 'element'
        ? child.children.map((value) => value.type === 'text' ? value.value : '').join('') : '').join('') ?? '';
      const text = codeValues.get(node?.position?.start.offset ?? -1) ?? renderedText;
      return <ReadmeCodeBlock text={text}>{children}</ReadmeCodeBlock>;
    },
    table: ({ children }) => <div className={styles.tableRegion} role="region" aria-label="README table" tabIndex={0}>
      <table>{children}</table>
    </div>,
    th: ({ children, align, style }) => <th scope="col" style={{ textAlign: align === 'center' || align === 'right' ? align : 'left', ...style }}>{children}</th>,
    td: ({ children, align, style }) => <td style={{ textAlign: align === 'center' || align === 'right' ? align : 'left', ...style }}>{children}</td>,
    a: ({ children, href }) => {
      if (href?.startsWith('#')) {
        let fragment = href.slice(1);
        try { fragment = decodeURIComponent(fragment); } catch { /* Keep malformed fragments readable. */ }
        const heading = document.headings.find((item) => item.slug === fragment || item.id === fragment);
        return <a href={heading ? '#' + encodeURIComponent(heading.id) : href}
          onClick={heading ? () => window.document.getElementById(heading.id)?.focus({ preventScroll: true }) : undefined}>{children}</a>;
      }
      return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
    },
  };
  return <ReactMarkdown components={components} remarkPlugins={[[preparedTree, document.tree]]}>
    {document.markdown}
  </ReactMarkdown>;
});
