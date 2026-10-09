import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

// Hand-mapped to this project's own design tokens rather than pulling
// in @tailwindcss/typography — a generic "prose" theme would bring its
// own color scheme, which conflicts with the "CSS variable tokens only"
// rule every other component in this project follows.
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-2 mb-2 font-display text-xl font-semibold text-text">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 border-t border-canvas-grid pt-3 font-display text-lg font-semibold text-text">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 font-display text-sm font-semibold text-text">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2 font-body text-sm leading-relaxed text-text-muted">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-2 flex list-inside list-disc flex-col gap-1 font-body text-sm text-text-muted">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 flex list-inside list-decimal flex-col gap-1 font-body text-sm text-text-muted">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
  em: ({ children }) => <em className="text-text-muted">{children}</em>,
  a: ({ children, href }) => (
    <a href={href} className="text-trace underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code className="block overflow-auto rounded-lg border border-canvas-grid bg-surface-raised p-3 font-mono text-xs text-text">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded border border-canvas-grid bg-surface-raised px-1 py-0.5 font-mono text-xs text-trace">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-2">{children}</pre>,
};

export function MarkdownContent({ markdown }: { markdown: string }) {
  return <ReactMarkdown components={MARKDOWN_COMPONENTS}>{markdown}</ReactMarkdown>;
}