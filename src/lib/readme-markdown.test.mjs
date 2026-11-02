import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { prepareReadmeDocument } from './readme-markdown.ts';

function nodes(root, type) {
  const found = [];
  function visit(node) {
    if (node.type === type) found.push(node);
    node.children?.forEach(visit);
  }
  visit(root);
  return found;
}

function text(node) {
  return node.value ?? node.children?.map(text).join('') ?? '';
}

test('preserves original Markdown and CommonMark structure, including unlabelled fences', () => {
  const source = '# Repository\n\nA **complete** paragraph with `inline code`.\n\n3. Parent\n   - Nested child\n\n> A quoted *explanation*.\n\n```\n  exact spacing\n```\n\n```sql\nSELECT 1;\n```\n';
  const document = prepareReadmeDocument(source, 'readme');
  assert.equal(document.markdown, source);
  assert.deepEqual(nodes(document.tree, 'code').map(({ lang, value }) => [lang, value]), [[null, '  exact spacing'], ['sql', 'SELECT 1;']]);
  assert.equal(nodes(document.tree, 'list')[0].start, 3);
  assert.equal(nodes(document.tree, 'list').length, 2);
  assert.equal(nodes(document.tree, 'blockquote').length, 1);
  assert.equal(nodes(document.tree, 'inlineCode')[0].value, 'inline code');
});

test('extracts only real headings and generates stable collision-safe IDs', () => {
  const source = '# Setup\n\n## Setup\n\n## Setup-1\n\n### **Caf\u00e9** `API`\n\n```md\n# Not a heading\n```';
  const document = prepareReadmeDocument(source, 'document');
  assert.deepEqual(document.headings.map(({ slug }) => slug), ['setup', 'setup-1', 'setup-1-1', 'caf\u00e9-api']);
  assert.equal(new Set(document.headings.map(({ id }) => id)).size, 4);
  assert.deepEqual(document.headings, prepareReadmeDocument(source, 'document').headings);
  assert.equal(document.headings[3].text, 'Caf\u00e9 API');
  assert.ok(nodes(document.tree, 'heading').every(({ data }) => data.hProperties.tabIndex === -1));
});

test('renders aligned pipe tables with inline formatting and reference links', () => {
  const source = 'Introduction\n| Name | Details |\n| :--- | ---: |\n| `a\\|b` | **Bold** and *emphasis* |\n| Next | [Guide][guide] |\n\n[guide]: https://example.com/docs "Guide title"\n';
  const document = prepareReadmeDocument(source, 'readme');
  const table = nodes(document.tree, 'table')[0];
  assert.equal(document.markdown, source);
  assert.deepEqual(table.align, ['left', 'right']);
  assert.equal(text(document.tree.children[0]), 'Introduction');
  assert.equal(table.children[1].children[0].children.find(({ type }) => type === 'inlineCode').value, 'a|b');
  assert.equal(nodes(table, 'strong').length, 1);
  assert.equal(nodes(table, 'emphasis').length, 1);
  assert.equal(nodes(table, 'linkReference')[0].identifier, 'guide');
  assert.equal(nodes(document.tree, 'definition')[0].url, 'https://example.com/docs');
});

test('handles escaped pipes and odd/even backslash runs without losing visible content', () => {
  const source = ['| A | B |', '| --- | --- |', '| left\\|right | end |', '| left' + '\\'.repeat(2) + '| end |', '| left' + '\\'.repeat(3) + '|right | end |'].join('\n');
  const table = nodes(prepareReadmeDocument(source, 'readme').tree, 'table')[0];
  assert.deepEqual(table.children.slice(1).map((row) => text(row.children[0])), ['left|right', 'left\\', 'left\\|right']);
});

test('does not reinterpret table-like content in fenced or indented code', () => {
  const source = '```\n| A | B |\n| --- | --- |\n| 1 | 2 |\n```\n\n    | A | B |\n    | --- | --- |\n';
  const document = prepareReadmeDocument(source, 'readme');
  assert.equal(nodes(document.tree, 'table').length, 0);
  assert.equal(nodes(document.tree, 'code').length, 2);
  assert.match(nodes(document.tree, 'code')[0].value, /\| 1 \| 2 \|/);
});

test('retains table content inside blockquotes and nested list items', () => {
  const source = '> | A | B |\n> | --- | --- |\n> | one | two |\n\n- Parent\n  | A | B |\n  | --- | --- |\n  | three | four |\n';
  const document = prepareReadmeDocument(source, 'readme');
  const tables = nodes(document.tree, 'table');
  assert.equal(tables.length, 2);
  assert.equal(text(tables[0].children[1]), 'onetwo');
  assert.equal(text(tables[1].children[1]), 'threefour');
  assert.equal(text(nodes(document.tree, 'listItem')[0].children[0]), 'Parent');
});

test('leaves ordinary pipes and malformed table separators as Markdown paragraphs', () => {
  const document = prepareReadmeDocument('Ordinary a | b text.\n\n| A | B |\n| --- | invalid |\n', 'readme');
  assert.equal(nodes(document.tree, 'table').length, 0);
  assert.match(text(document.tree), /Ordinary a \| b text/);
});

test('rendered AST retains safe Markdown links, heading IDs, and semantic table elements', () => {
  const source = '# Repository\r\n\r\n| Name | Link |\r\n| --- | --- |\r\n| item | [Guide](https://example.com) |\r\n\r\n[Unsafe](javascript:alert)\r\n';
  const document = prepareReadmeDocument(source, 'readme');
  const preparedTree = (tree) => () => tree;
  const rendered = renderToStaticMarkup(React.createElement(ReactMarkdown, { remarkPlugins: [[preparedTree, document.tree]] }, document.markdown));
  assert.equal(document.markdown, source);
  assert.match(rendered, /id="readme-repository"/);
  assert.match(rendered, /<table>/);
  assert.match(rendered, /<thead>/);
  assert.match(rendered, /<tbody>/);
  assert.match(rendered, /href="https:\/\/example.com"/);
  assert.doesNotMatch(rendered, /href="javascript:/);
});
