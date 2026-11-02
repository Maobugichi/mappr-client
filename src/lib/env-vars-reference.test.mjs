import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeEnvTemplate, envExamplePolicy, UnsafeEnvExampleError } from './env-vars-reference.ts';

const variable = (placeholder, extra = {}) => ({ name: 'APP_VALUE', secret: false, required: true, description: 'Original description.', nodeId: null, techStackCategory: null, placeholder, ...extra });

test('copies only clearly safe public examples and placeholders', () => {
  for (const value of ['3000', '0', 'false', 'development', 'info', 'YOUR_PROJECT_VALUE', 'your-project-value', '${APP_VALUE}', 'http://localhost:3000', 'http://127.0.0.1:4000', 'http://[::1]:4000', 'https://api.example.com/v1', 'https://api.service.test']) {
    assert.deepEqual(envExamplePolicy(variable(value)), { hidden: false, canCopy: true });
  }
});

test('keeps ordinary non-sensitive examples visible without guessing that they are copy-safe', () => {
  for (const value of ['ordinary project name', 'https://api.product.com/v1', 'person@example.com', 'https://example.com/search?q=term']) {
    assert.deepEqual(envExamplePolicy(variable(value)), { hidden: false, canCopy: false });
  }
});

test('never enables example copy for Secret metadata and preserves clear secret placeholders', () => {
  for (const placeholder of ['YOUR_API_KEY', '<YOUR_API_KEY>', 'GENERATE_A_RANDOM_32_BYTE_KEY', 'change-me']) {
    assert.deepEqual(envExamplePolicy(variable(placeholder, { name: 'API_KEY', secret: true })), { hidden: false, canCopy: false });
  }
  assert.deepEqual(envExamplePolicy(variable('private-value', { name: 'APP_VALUE', secret: true })), { hidden: true, canCopy: false });
});

test('withholds credential-shaped strings even when metadata marks them Config', () => {
  const token = 'sk_live_' + 'a'.repeat(32);
  const values = [token, '%2573k_live_' + 'a'.repeat(32), 'ghp_' + 'b'.repeat(32), 'AKIA' + 'A'.repeat(16), 'eyJ' + 'a'.repeat(10) + '.' + 'b'.repeat(12) + '.' + 'c'.repeat(20), 'Bearer private-value', 'Basic YTpiYzEyMzQ1Ng==', 'postgresql://user:password@localhost:5432/app', 'https://example.com?api_key=private-value', 'https://example.com/reset/' + 'c'.repeat(40), 'd'.repeat(40), 'password=private-value'];
  for (const value of values) assert.deepEqual(envExamplePolicy(variable(value)), { hidden: true, canCopy: false });
  assert.deepEqual(envExamplePolicy(variable('private-value', { name: 'NEXT_PUBLIC_ANALYTICS_TOKEN' })), { hidden: true, canCopy: false });
});

test('validates the existing template format without modifying metadata or template bytes', () => {
  const vars = [variable('YOUR_JWT_SECRET', { name: 'JWT_SECRET', secret: true }), variable('<YOUR_API_KEY>', { name: 'API_KEY', secret: true })];
  const original = JSON.stringify(vars);
  const template = ['# General', 'NODE_ENV=development', 'PORT=3000', 'EMPTY=', '', '# Next.js Web App', 'NEXT_PUBLIC_API_URL=http://localhost:3001', '', '# Express API & Cron', 'JWT_SECRET=YOUR_JWT_SECRET', "export API_KEY = '<YOUR_API_KEY>' # original comment", 'MESSAGE="first # literal', 'second = literal"', ''].join('\r\n');
  assert.doesNotThrow(() => assertSafeEnvTemplate(template, vars));
  assert.equal(JSON.stringify(vars), original);
  assert.ok(template.includes('\r\n'));
});

test('accepts an already blanked server export even if a saved placeholder was unsafe', () => {
  assert.doesNotThrow(() => assertSafeEnvTemplate('# General\nAPP_VALUE=\n', [variable('private-value', { secret: true })]));
});

test('blocks unsafe quoted, multiline, unknown-token and comment values before download', () => {
  const vars = [variable('private-value', { secret: true })];
  const templates = ['APP_VALUE=private-value\n', 'APP_VALUE="private-value\nsecond line"\n', 'OTHER_TOKEN=private-value\n', 'OTHER_VALUE=sk_live_' + 'a'.repeat(32) + '\n', '# password=private-value\nPORT=3000\n', '# -----BEGIN PRIVATE KEY-----\nPORT=3000\n'];
  for (const template of templates) {
    assert.throws(() => assertSafeEnvTemplate(template, vars), (error) => error instanceof UnsafeEnvExampleError && !error.message.includes('private-value'));
  }
});

test('fails closed for malformed templates and respects quoted hashes and escaped quotes', () => {
  for (const template of ['not an assignment', 'APP_VALUE="unclosed\n', 'APP_VALUE="closed" trailing text\n']) {
    assert.throws(() => assertSafeEnvTemplate(template, []), /format could not be checked safely/);
  }
  assert.doesNotThrow(() => assertSafeEnvTemplate('APP_VALUE="a # literal hash and \\"quoted\\" word"\n', []));
});
