import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes, Paragraph, PhrasingContent, Root, RootContent, Table } from 'mdast';

type Heading = { id: string; slug: string; text: string; depth: number };
export type ReadmeDocument = { markdown: string; tree: Root; headings: Heading[] };

function splitRow(line: string): { cells: string[]; hasPipe: boolean } {
  const value = line.trim();
  const cells = [''];
  let hasPipe = false;
  let trailingPipe = false;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === '\\') {
      let end = index;
      while (value[end] === '\\') end++;
      const count = end - index;
      if (value[end] === '|' && count % 2 === 1) {
        cells[cells.length - 1] += '\\'.repeat(count - 1) + '|';
        index = end;
      } else {
        cells[cells.length - 1] += '\\'.repeat(count);
        index = end - 1;
      }
      trailingPipe = false;
    } else if (character === '|') {
      hasPipe = true;
      trailingPipe = true;
      cells.push('');
    } else {
      cells[cells.length - 1] += character;
      trailingPipe = false;
    }
  }
  if (value.startsWith('|')) cells.shift();
  if (trailingPipe) cells.pop();
  return { cells: cells.map((cell) => cell.trim()), hasPipe };
}

function inlineCell(value: string, definitions: string): PhrasingContent[] {
  // Reuse the parser already used by react-markdown. A punctuation prefix
  // prevents a cell's leading '#', '-', or '>' from becoming a block.
  const paragraph = fromMarkdown('@' + value + definitions).children[0];
  if (paragraph?.type !== 'paragraph') return [{ type: 'text', value }];
  const first = paragraph.children[0];
  if (first?.type === 'text') first.value = first.value.slice(1);
  return paragraph.children;
}

function paragraphTable(node: Paragraph, markdown: string, definitions: string): RootContent[] | null {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return null;
  const indentation = (node.position?.start.column ?? 1) - 1;
  const lines = markdown.slice(start, end).split(/\r\n|\n|\r/).map((line, index) =>
    index === 0 ? line : line.replace(new RegExp(`^[\\t >]{0,${indentation}}`), ''));
  for (let index = 0; index < lines.length - 1; index++) {
    const header = splitRow(lines[index]);
    const separator = splitRow(lines[index + 1]);
    if (!header.hasPipe || header.cells.length === 0 || header.cells.length !== separator.cells.length
      || !separator.cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    const align: Table['align'] = separator.cells.map((cell) => cell.startsWith(':')
      ? cell.endsWith(':') ? 'center' : 'left' : cell.endsWith(':') ? 'right' : null);
    const rows = [header.cells, ...lines.slice(index + 2).map((line) => splitRow(line).cells)];
    const table: Table = {
      type: 'table', align,
      children: rows.map((cells) => ({ type: 'tableRow', children: header.cells.map((_, column) => ({
        type: 'tableCell', children: inlineCell(cells[column] ?? '', definitions),
      })) })),
    };
    const prefix = index > 0 ? fromMarkdown(lines.slice(0, index).join('\n') + definitions).children
      .filter((child) => child.type !== 'definition') : [];
    return [...prefix, table];
  }
  return null;
}

function textOf(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  if (node.type === 'image' || node.type === 'imageReference') return node.alt ?? '';
  if (node.type === 'break') return ' ';
  return 'children' in node ? node.children.map(textOf).join('') : '';
}

export function prepareReadmeDocument(markdown: string, prefix: string): ReadmeDocument {
  const tree = fromMarkdown(markdown);
  const definitions: string[] = [];
  const collectDefinitions = (node: Nodes) => {
    if (node.type === 'definition' && node.position?.start.offset !== undefined && node.position.end.offset !== undefined) {
      definitions.push(markdown.slice(node.position.start.offset, node.position.end.offset));
    }
    if ('children' in node) node.children.forEach(collectDefinitions);
  };
  collectDefinitions(tree);
  const definitionSource = definitions.length ? '\n\n' + definitions.join('\n') : '';
  // Only paragraph blocks can become pipe tables. Fences, indented code,
  // inline code, and all other CommonMark structures retain their AST.
  const tables = (parent: { children: RootContent[] }) => {
    const children: RootContent[] = [];
    for (const node of parent.children) {
      if (node.type === 'blockquote') tables(node);
      if (node.type === 'list') node.children.forEach(tables);
      const replacement = node.type === 'paragraph' ? paragraphTable(node, markdown, definitionSource) : null;
      children.push(...(replacement ?? [node]));
    }
    parent.children = children;
  };
  tables(tree);

  const headings: Heading[] = [];
  const used = new Set<string>();
  const identify = (node: Nodes) => {
    if (node.type === 'heading') {
      const text = textOf(node);
      const base = text.toLowerCase().trim().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s+/g, '-') || 'section';
      let slug = base;
      let suffix = 0;
      while (used.has(slug)) slug = base + '-' + ++suffix;
      used.add(slug);
      const id = prefix + '-' + slug;
      node.data = { ...node.data, hProperties: { id, tabIndex: -1 } };
      headings.push({ id, slug, text, depth: node.depth });
    }
    if ('children' in node) node.children.forEach(identify);
  };
  identify(tree);
  return { markdown, tree, headings };
}

