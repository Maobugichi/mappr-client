import ReactMarkdown, { type Components } from 'react-markdown';
import { memo, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CheckIcon, CopyIcon, MagnifyingGlassIcon, WarningIcon } from '@phosphor-icons/react';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import type { DeploymentDocument } from '@/lib/deployment-runbook';
import styles from './DeploymentView.module.css';

const preparedTree: Plugin<[Root], Root> = (tree) => () => tree;

function DeploymentCodeBlock({ text, children }: { text: string; children: ReactNode }) {
  const id = useId();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const pending = useRef(false);
  const request = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => {
    request.current++;
    pending.current = false;
    window.clearTimeout(timer.current);
  }, [text]);

  const copy = async () => {
    if (pending.current) return;
    pending.current = true;
    const current = ++request.current;
    window.clearTimeout(timer.current);
    setState('idle');
    try {
      await navigator.clipboard.writeText(text);
      if (request.current !== current) return;
      setState('copied');
      timer.current = window.setTimeout(() => setState('idle'), 2000);
    } catch {
      if (request.current === current) setState('failed');
    } finally {
      if (request.current === current) pending.current = false;
    }
  };

  return <div className={styles.codeBlock}>
    <button type="button" className={styles.copy} data-state={state}
      aria-label={state === 'failed' ? 'Retry copying code block' : 'Copy code block'}
      aria-controls={id + '-code'} aria-describedby={state === 'failed' ? id + '-status' : undefined}
      title={state === 'copied' ? 'Copied' : 'Copy code'} onClick={() => void copy()}>
      {state === 'copied' ? <CheckIcon size={14} weight="bold" aria-hidden="true" />
        : state === 'failed' ? <WarningIcon size={14} aria-hidden="true" /> : <CopyIcon size={14} aria-hidden="true" />}
    </button>
    <pre id={id + '-code'} tabIndex={0} aria-label="Deployment code block">{children}</pre>
    <p id={id + '-status'} role="status" aria-live="polite" aria-atomic="true"
      className={state === 'failed' ? styles.copyError : styles.copyFeedback}>
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy. Select the code and copy it manually.' : ''}
    </p>
  </div>;
}

export const DeploymentMarkdown = memo(function DeploymentMarkdown({ document }: { document: DeploymentDocument }) {
  const components: Components = {
    h3: ({ node, children, ...props }) => {
      const number = node?.properties['data-sequence'];
      return <h3 {...props}>{number !== undefined && <span className={styles.sequence}
        aria-label={'Component ' + number}>{String(number)}</span>}{children}</h3>;
    },
    pre: ({ node, children }) => {
      const renderedText = node?.children.map((child) => child.type === 'element'
        ? child.children.map((value) => value.type === 'text' ? value.value : '').join('') : '').join('') ?? '';
      // AST values exclude the synthetic trailing newline added by the renderer.
      const text = document.code.get(node?.position?.start.offset ?? -1) ?? renderedText;
      return <DeploymentCodeBlock key={text} text={text}>{children}</DeploymentCodeBlock>;
    },
    p: ({ node, children, ...props }) => node?.properties['data-runbook'] === 'verification'
      ? <div className={styles.verification}><MagnifyingGlassIcon size={16} aria-hidden="true" /><p {...props}>{children}</p></div>
      : <p {...props}>{children}</p>,
    a: ({ children, href }) => <a href={href} target={href?.startsWith('#') ? undefined : '_blank'} rel="noreferrer">{children}</a>,
  };
  return <ReactMarkdown components={components} remarkPlugins={[[preparedTree, document.tree]]}>
    {document.markdown}
  </ReactMarkdown>;
});
