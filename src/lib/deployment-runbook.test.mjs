import assert from 'node:assert/strict';
import test from 'node:test';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { prepareDeploymentDocument } from './deployment-runbook.ts';

const fixture = `# Deployment Runbook

## Deploy order

**Warning:** Circular dependency; this is a best-guess order.

1. Database
2. API

## How components connect

- API → Database (stores records)

## Component runbooks

Shared environment guidance.

### 1. Database

**Managed resource** · Provider · Internal

**Steps**

1. Provision the database.
2. Configure the API.

**Environment variables**

- \`DATABASE_URL\` (secret) — Database connection reference.

**Verify:** Inspect the schema.

**Rollback:** Restore the documented backup.

### 2. API

**Application** · Provider · Public

1. Deploy the API.

\`\`\`sh
npm install
  npm run build

npm start
\`\`\`

**Verify:** Request the documented health endpoint.

## Before you start

### Provider account

1. Create the required account.
2. Save the credentials in the provider's secret manager.

## Future operational guidance

Do not discard unknown content, [references][guide], or nested lists.

- Parent
  - Child

[guide]: https://example.com/docs
`;

const value = (node) => 'value' in node ? node.value : (node.children ?? []).map(value).join('');
const walk = (node, fn) => { fn(node); node.children?.forEach((child) => walk(child, fn)); };

test('moves complete prerequisites first and connections after all component procedures', () => {
  const { tree } = prepareDeploymentDocument(fixture);
  assert.deepEqual(tree.children.filter((node) => node.type === 'heading' && node.depth === 2).map(value), [
    'Before you start', 'Deploy order', 'Component runbooks', 'How components connect', 'Future operational guidance',
  ]);
  const components = tree.children.filter((node) => node.data?.hProperties?.['data-runbook'] === 'component');
  assert.equal(components.length, 2);
  assert.deepEqual(components.map((node) => value(node.children[0])), ['Database', 'API']);
  assert.match(value(components[0]), /Provision the database.*Configure the API.*DATABASE_URL.*Inspect the schema.*Restore/s);
  assert.match(value(components[1]), /Deploy the API.*npm install.*Request the documented health/s);
  assert.equal(components[0].children[0].data.hProperties['data-sequence'], '1');
  assert.equal(components[1].children[0].data.hProperties['data-sequence'], '2');
});

test('preserves every original Markdown node and exact export bytes', () => {
  const document = prepareDeploymentDocument(fixture);
  const original = fromMarkdown(fixture);
  function signatures(tree) {
    const result = [];
    function collect(node) {
      if (node.data?.hName === 'section') return node.children.forEach(collect);
      const normalized = JSON.parse(JSON.stringify(node, (key, val) => key === 'data' || key === 'position' ? undefined : val));
      const sequence = node.data?.hProperties?.['data-sequence'];
      if (sequence) normalized.children[0].value = sequence + '. ' + normalized.children[0].value;
      result.push(JSON.stringify(normalized));
    }
    tree.children.forEach(collect);
    return result.sort();
  }
  assert.deepEqual(signatures(document.tree), signatures(original));
  assert.equal(document.markdown, fixture);
});

test('keeps warnings ahead of procedures, verification local, metadata subordinate, and code exact', () => {
  const { tree, code } = prepareDeploymentDocument(fixture);
  const kinds = [];
  walk(tree, (node) => { if (node.data?.hProperties?.['data-runbook']) kinds.push(node.data.hProperties['data-runbook']); });
  assert.equal(kinds.filter((kind) => kind === 'verification').length, 2);
  assert.equal(kinds.filter((kind) => kind === 'metadata').length, 2);
  assert.equal(kinds.filter((kind) => kind === 'warning').length, 1);
  assert.equal(kinds.filter((kind) => kind === 'connections').length, 1);
  assert.equal([...code.values()][0], 'npm install\n  npm run build\n\nnpm start');
  const warning = tree.children.findIndex((node) => node.data?.hProperties?.['data-runbook'] === 'warning');
  const component = tree.children.findIndex((node) => node.data?.hProperties?.['data-runbook'] === 'component');
  assert.ok(warning < component);
});

test('retains unfamiliar documents and non-component headings without inferring procedures', () => {
  for (const markdown of ['', 'Plain instructions.', '# Notes\n\n### 1. Example\n\nKeep this.', '## How components connect\n\nA → B\n\n## Other\n\nKeep this.']) {
    const document = prepareDeploymentDocument(markdown);
    assert.deepEqual(document.tree, fromMarkdown(markdown));
    assert.equal(document.markdown, markdown);
  }
});

test('collects fenced blocks with no language, tilde fences, indentation and empty content', () => {
  const markdown = '```\nnpm install\n```\n\n~~~sh\n  line one\n\nline two\n~~~\n\n```\n```\n';
  assert.deepEqual([...prepareDeploymentDocument(markdown).code.values()], ['npm install', '  line one\n\nline two', '']);
});
