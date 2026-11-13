import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { registerHooks, createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';

// Match the bundler's extensionless local TS imports for native Node tests.
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(specifier + '.ts', context);
    throw error;
  }
} });
process.env.NEXT_PUBLIC_API_URL = 'https://api.mappr.test';
const { OverviewChangeController } = await import('./overview-change.ts');
const { ApiError, getEditEligibility, previewOverviewChange, applyOverviewChange } = await import('./api.ts');
const { assertOverviewProposal, sameData } = await import('./overview-change-contract.ts');
const realFetch = globalThis.fetch;
after(() => { globalThis.fetch = realFetch; hooks.deregister(); });

const mapId = 'c91911c8-f746-4547-b7bf-2f9210774992';
const proposalId = 'ce841a20-e4a2-4e27-8f26-8fdd2f3e6300';
const base = {
  meta: { productName: 'Mappr sample', oneLineSummary: 'A distinct header.' },
  product: { summary: 'Original product summary.', concepts: ['Bookings'] },
  users: [], features: [], techStack: [], architecture: { nodes: [], edges: [] },
  dataModel: { entities: [], relations: [] },
  designSystem: { colors: [], typography: [], spacing: [], components: [] }, developmentPlan: [],
};
const updated = { ...base, product: { ...base.product, summary: 'A booking tool for independent coworking spaces.' } };
function diff() {
  const array = () => ({ added: [], removed: [], changed: [] });
  const list = () => ({ added: [], removed: [] });
  return {
    hasChanges: true, meta: [],
    product: { summary: [{ field: 'summary', before: base.product.summary, after: updated.product.summary }], concepts: list() },
    users: array(), features: array(), techStack: array(), architecture: { nodes: array(), edges: list() },
    dataModel: { entities: array(), relations: list() },
    designSystem: { colors: array(), typography: array(), spacing: array(), components: array() }, developmentPlan: array(),
  };
}
function proposal() {
  return {
    contractVersion: 1, mapId, proposalId, status: 'ready', baseRevision: 1,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString(),
    summary: 'Clarify the product audience.', operations: [{ op: 'set_field', path: 'product.summary', value: updated.product.summary }],
    diff: diff(), affectedSections: ['product'],
    warnings: [{ code: 'summary_only', message: 'Review technical scope separately.', sections: ['features'] }],
    artifactImpacts: [{ artifactType: 'readme', action: 'invalidate', reason: 'source_changed' }],
  };
}
function receipt() {
  return {
    mapId, proposalId, status: 'applied', previousRevision: 1, revision: 2, version: 2,
    appliedAt: new Date().toISOString(), summary: 'Updated the summary.', data: updated,
    diff: diff(), affectedSections: ['product'], warnings: [],
    artifactFreshness: { readme: { status: 'stale', sourceRevision: 1, reason: 'source_changed' } },
  };
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', Date: new Date().toUTCString(), ...headers } });
}
function failure(error, status, retry, headers = {}) {
  return json({ error, message: 'Actual server explanation.', requestId: 'request-reference', ...(retry ? { retry } : {}) }, status, headers);
}
function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}
let calls, serverMap, routes;
beforeEach(() => {
  calls = [];
  serverMap = { id: mapId, data: base, revision: 1 };
  routes = {};
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    assert.equal(new URL(url).origin, 'https://api.mappr.test', 'no real backend calls');
    calls.push({ path, init });
    if (routes[path]) return routes[path](init);
    if (path.endsWith('/edit-eligibility')) return json({ mapId, canEdit: true });
    if (path === `/maps/${mapId}`) return json(serverMap);
    if (path.endsWith('/changes/preview')) return json(proposal(), 201);
    if (path.endsWith('/apply')) { serverMap = { id: mapId, data: updated, revision: 2 }; return json(receipt()); }
    throw new Error('Unexpected mocked HTTP request: ' + path);
  };
});
const previewPath = `/maps/${mapId}/changes/preview`;
const applyPath = `/maps/${mapId}/changes/${proposalId}/apply`;
const writes = () => calls.filter((x) => x.init.method === 'POST');
async function ready() {
  const controller = new OverviewChangeController(mapId, base, 1);
  await controller.activate();
  controller.setDraft('Clarify the product audience.');
  return controller;
}

test('eligibility and change helpers use exact bodies, browser credentials and uncached requests', async () => {
  const body = { instruction: 'Clarify the product summary.', context: { activeView: 'overview', selectedTarget: null }, expectedBaseRevision: 1 };
  await getEditEligibility(mapId);
  await previewOverviewChange(mapId, body, proposalId);
  await applyOverviewChange(mapId, proposalId, 1);
  for (const call of calls) {
    assert.equal(call.init.credentials, 'include');
    assert.equal(call.init.cache, 'no-store');
    assert.equal(call.init.headers.Origin, undefined);
    assert.equal(call.init.headers.Cookie, undefined);
  }
  assert.deepEqual(JSON.parse(writes()[0].init.body), body);
  assert.equal(writes()[0].init.headers['Idempotency-Key'], proposalId);
  assert.deepEqual(JSON.parse(writes()[1].init.body), { approved: true, expectedBaseRevision: 1 });
});

test('preview never changes canonical data; approval installs authoritative data and revision atomically', async () => {
  const c = await ready(), snapshots = [];
  c.subscribe(() => snapshots.push(c.getSnapshot().canonical));
  await c.preview();
  assert.equal(c.getSnapshot().canonical.data, base);
  assert.equal(c.getSnapshot().canonical.revision, 1);
  assert.equal(c.canApply(), true);
  assert.equal(writes().length, 1);
  await c.apply();
  assert.equal(c.getSnapshot().canonical.data.product.summary, updated.product.summary);
  assert.equal(c.getSnapshot().canonical.data.meta.oneLineSummary, base.meta.oneLineSummary);
  assert.equal(c.getSnapshot().canonical.revision, 2);
  assert.equal(c.getSnapshot().draft, '');
  assert.equal(c.getSnapshot().artifactFreshness.readme.status, 'stale');
  assert.ok(snapshots.every((s) => s.revision === 1 ? s.data === base : s.data.product.summary === updated.product.summary));
});

test('unknown, denied, and malformed eligibility never grant editing or hide canonical read data', async () => {
  for (const response of [failure('session_required', 401), failure('not_found', 404), failure('origin_not_allowed', 403),
    failure('unavailable', 503), json({ mapId: 'another-map', canEdit: true }), json({ mapId, canEdit: false })]) {
    routes[`/maps/${mapId}/edit-eligibility`] = () => response.clone();
    const c = new OverviewChangeController(mapId, base, 1);
    await c.activate();
    c.setDraft('Keep this draft');
    await c.preview();
    assert.notEqual(c.getSnapshot().eligibility, 'owner');
    assert.equal(c.getSnapshot().canonical.data, base);
    assert.equal(c.getSnapshot().draft, 'Keep this draft');
    assert.equal(c.canApply(), false);
  }
  assert.equal(writes().length, 0);
});

test('missing or malformed revisions block preview without assuming baseline revision 1', async () => {
  for (const revision of [undefined, null, 0, '1']) {
    serverMap = { ...serverMap, revision };
    const c = new OverviewChangeController(mapId, base);
    await c.activate();
    c.setDraft('Keep draft');
    await c.preview();
    assert.equal(c.getSnapshot().canonical.revision, null);
    assert.equal(c.getSnapshot().draft, 'Keep draft');
  }
  assert.equal(writes().length, 0);
});

test('backend interlock and policy errors remain unavailable, preserving drafts without iteration fallback', async () => {
  for (const code of ['feature_disabled', 'preview_policy_not_configured', 'revision_not_ready']) {
    routes[previewPath] = () => failure(code, 503, 'none');
    const c = await ready();
    await c.preview();
    assert.match(c.getSnapshot().feedback.message, /currently unavailable/);
    assert.equal(c.getSnapshot().feedback.requestId, 'request-reference');
    assert.equal(c.getSnapshot().draft, 'Clarify the product audience.');
    assert.equal(c.getSnapshot().proposal, null);
    assert.equal(c.getSnapshot().pending, null);
    assert.equal(c.getSnapshot().retry, null);
  }
  assert.ok(calls.every((x) => !x.path.endsWith('/iterate')));
});

test('a double click admits one pending preview; subscriptions can unmount without losing the draft/result', async () => {
  const c = await ready(), wait = deferred();
  routes[previewPath] = () => wait.promise;
  const unsubscribe = c.subscribe(() => {});
  const first = c.preview();
  await c.preview();
  unsubscribe();
  // Allow the admitted request to reach the mocked HTTP boundary.
  while (!writes().length) await new Promise((resolve) => setImmediate(resolve));
  wait.resolve(json(proposal(), 201));
  await first;
  assert.equal(writes().length, 1);
  assert.equal(c.getSnapshot().draft, 'Clarify the product audience.');
  assert.ok(c.getSnapshot().proposal);
  await c.activate();
  assert.ok(c.getSnapshot().proposal, 'returning to Overview preserves review');
});

test('lost preview responses reuse the captured body/key; a deliberate new preview uses a new key', async () => {
  const c = await ready();
  routes[previewPath] = () => { throw new TypeError('Disconnected'); };
  await c.preview();
  const first = writes()[0];
  c.setDraft('A different future instruction.');
  delete routes[previewPath];
  await c.preview(true);
  assert.equal(writes()[1].init.body, first.init.body);
  assert.equal(writes()[1].init.headers['Idempotency-Key'], first.init.headers['Idempotency-Key']);
  assert.equal(c.getSnapshot().draft, 'A different future instruction.');
  c.discard();
  await c.preview();
  assert.notEqual(writes()[2].init.headers['Idempotency-Key'], first.init.headers['Idempotency-Key']);
  assert.equal(JSON.parse(writes()[2].init.body).instruction, 'A different future instruction.');
});

test('preview_in_progress respects Retry-After and does not create another identity', async () => {
  const c = await ready();
  routes[previewPath] = () => failure('preview_in_progress', 409, 'same_request', { 'Retry-After': '2' });
  await c.preview();
  assert.ok(c.getSnapshot().retry.notBefore > Date.now());
  await c.preview(true);
  assert.equal(writes().length, 1);
  const clock = Date.now;
  const future = c.getSnapshot().retry.notBefore + 10;
  Date.now = () => future;
  try { delete routes[previewPath]; await c.preview(true); }
  finally { Date.now = clock; }
  assert.equal(writes().length, 2);
  assert.equal(writes()[0].init.headers['Idempotency-Key'], writes()[1].init.headers['Idempotency-Key']);
});

test('terminal preview errors restore controls and retain drafts; only explicit new preview creates a new attempt', async () => {
  for (const [code, status] of [['unsupported_scope', 422], ['no_changes', 422], ['change_not_valid', 422],
    ['change_generation_failed', 502], ['generation_timeout', 504], ['idempotency_key_reused', 409]]) {
    const c = await ready();
    routes[previewPath] = () => failure(code, status, 'new_preview');
    await c.preview();
    assert.equal(c.getSnapshot().retry, null);
    assert.equal(c.getSnapshot().pending, null);
    assert.equal(c.getSnapshot().draft, 'Clarify the product audience.');
    assert.match(c.getSnapshot().feedback.message, new RegExp(code));
  }
});

test('out-of-scope, incomplete, or mismatched server diffs cannot enable approval', async () => {
  const bad = [
    { ...proposal(), operations: [{ op: 'set_field', path: 'meta.oneLineSummary', value: 'Wrong field' }] },
    { ...proposal(), baseRevision: 99 }, { ...proposal(), diff: {} },
    { ...proposal(), diff: { ...diff(), meta: [{ field: 'productName', before: 'A', after: 'B' }] } },
    { ...proposal(), operations: [{ op: 'set_field', path: 'product.summary', value: 'Not the reviewed diff' }] },
    { ...proposal(), expiresAt: 'Invalid date' }, { ...proposal(), mapId: 'wrong-map' },
  ];
  for (const response of bad) {
    const c = await ready();
    routes[previewPath] = () => json(response, 201);
    await c.preview();
    assert.equal(c.getSnapshot().proposal, null);
    assert.equal(c.getSnapshot().canonical.data, base);
    assert.equal(c.canApply(), false);
    assert.equal(c.getSnapshot().retry, null);
  }
  assert.equal(writes().filter((x) => x.path.endsWith('/apply')).length, 0);
});

test('expired preview is inspectable, non-actionable, and never automatically renewed', async () => {
  const c = await ready();
  const p = { ...proposal(), createdAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() - 10000).toISOString() };
  routes[previewPath] = () => json(p, 201);
  await c.preview();
  assert.ok(c.getSnapshot().proposal);
  assert.equal(c.canApply(), false);
  await c.apply();
  assert.equal(writes().length, 1);
  assert.equal(c.getSnapshot().canonical.revision, 1);
});

test('absolute expiry uses an exposed server clock without trusting the local clock for permission', async () => {
  const c = await ready(), p = proposal();
  routes[previewPath] = () => json(p, 201, { Date: new Date(Date.now() + 3600000).toUTCString() });
  await c.preview();
  assert.equal(c.canApply(), false);
  assert.ok(c.getSnapshot().serverOffset > 3500000);
});

test('server expiry retains the diff and draft while disabling approval', async () => {
  const c = await ready();
  await c.preview();
  routes[applyPath] = () => failure('proposal_expired', 410, 'new_preview');
  await c.apply();
  assert.ok(c.getSnapshot().proposal);
  assert.match(c.getSnapshot().proposalIssue, /expired/);
  assert.equal(c.canApply(), false);
  assert.equal(c.getSnapshot().draft, 'Clarify the product audience.');
  assert.equal(c.getSnapshot().canonical.revision, 1);
});

test('lost apply outcome retries identical approval/proposal even after the preview expires', async () => {
  const c = await ready();
  await c.preview();
  routes[applyPath] = () => { throw new TypeError('Disconnected after commit'); };
  await c.apply();
  assert.equal(c.getSnapshot().retry.kind, 'apply');
  assert.equal(c.getSnapshot().draft, 'Clarify the product audience.');
  c.discard();
  assert.ok(c.getSnapshot().proposal, 'uncertain outcome is retained for recovery');
  const firstApproval = writes()[1];
  const clock = Date.now;
  const future = Date.parse(c.getSnapshot().proposal.expiresAt) + 10000;
  Date.now = () => future;
  try { delete routes[applyPath]; await c.apply(true); }
  finally { Date.now = clock; }
  assert.equal(writes()[2].path, firstApproval.path);
  assert.equal(writes()[2].init.body, firstApproval.init.body);
  assert.equal(c.getSnapshot().canonical.revision, 2);
  assert.equal(c.getSnapshot().appliedRevision, 2);
});

test('delayed apply receipt cannot overwrite newer canonical data or artifact metadata', async () => {
  const c = await ready(), wait = deferred();
  await c.preview();
  routes[applyPath] = () => wait.promise;
  const applying = c.apply();
  while (!writes().some((x) => x.path === applyPath)) await new Promise((resolve) => setImmediate(resolve));
  const newer = { ...base, product: { ...base.product, summary: 'Newer accepted summary.' } };
  c.acceptIteration(newer, 9, mapId);
  serverMap = { id: mapId, data: newer, revision: 9 };
  wait.resolve(json(receipt()));
  await applying;
  assert.equal(c.getSnapshot().canonical.revision, 9);
  assert.equal(c.getSnapshot().canonical.data, newer);
  assert.equal(c.getSnapshot().artifactFreshness, null);
  assert.equal(c.getSnapshot().appliedRevision, 2);
  assert.match(c.getSnapshot().feedback.message, /Newer revision 9/);
});

test('high-water gate covers legacy iteration, equal-data property order, stale GETs and foreign maps', async () => {
  const c = await ready();
  c.acceptIteration(updated, 9, mapId);
  c.acceptIteration(base, 8, mapId);
  assert.equal(c.getSnapshot().canonical.revision, 9);
  assert.equal(c.acceptCanonical(mapId, { ...updated, product: { concepts: ['Bookings'], summary: updated.product.summary } }, 9), 'same');
  assert.equal(c.acceptCanonical(mapId, base, 9), 'invalid');
  assert.equal(c.acceptCanonical('other-map', base, 99), 'invalid');
  await c.activate(); // Mocked GET is still revision 1.
  assert.equal(c.getSnapshot().canonical.revision, 9);
  assert.equal(c.getSnapshot().canonical.data, updated);
  assert.equal(c.getSnapshot().refreshRequired, true);
  assert.equal(c.canApply(), false);
  assert.equal(sameData({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
});

test('a conflict refreshes coherent data and requires an explicit new preview; it never rebases or applies', async () => {
  const c = await ready();
  await c.preview();
  serverMap = { id: mapId, data: updated, revision: 2 };
  routes[applyPath] = () => failure('revision_conflict', 409, 'refresh_map');
  await c.apply();
  assert.equal(c.getSnapshot().canonical.revision, 2);
  assert.ok(c.getSnapshot().proposal);
  assert.match(c.getSnapshot().proposalIssue, /new preview/);
  assert.equal(c.getSnapshot().draft, 'Clarify the product audience.');
  assert.equal(c.canApply(), false);
  assert.equal(writes().length, 2);
});

test('a late preview becomes non-actionable when canonical data has advanced', async () => {
  const c = await ready(), wait = deferred();
  routes[previewPath] = () => wait.promise;
  const pending = c.preview();
  while (!writes().length) await new Promise((resolve) => setImmediate(resolve));
  c.acceptIteration(updated, 2, mapId);
  wait.resolve(json(proposal(), 201));
  await pending;
  assert.ok(c.getSnapshot().proposal);
  assert.equal(c.canApply(), false);
  assert.equal(c.getSnapshot().canonical.revision, 2);
});

test('eligibility loss before Apply clears authorization-bound actions and makes no approval request', async () => {
  const c = await ready();
  await c.preview();
  routes[`/maps/${mapId}/edit-eligibility`] = () => failure('session_required', 401);
  await c.apply();
  assert.equal(c.getSnapshot().eligibility, 'denied');
  assert.equal(c.getSnapshot().proposal, null);
  assert.equal(c.getSnapshot().draft, 'Clarify the product audience.');
  assert.equal(writes().length, 1);
});

test('temporary eligibility failure preserves an inspectable preview and draft without allowing approval', async () => {
  const c = await ready();
  await c.preview();
  routes[`/maps/${mapId}/edit-eligibility`] = () => failure('temporarily_unavailable', 503);
  await c.activate();
  assert.equal(c.getSnapshot().eligibility, 'unknown');
  assert.ok(c.getSnapshot().proposal);
  assert.equal(c.canApply(), false);
  assert.equal(c.getSnapshot().draft, 'Clarify the product audience.');
});

test('map unmount/switch discards late authorization and proposals without touching another map', async () => {
  const old = await ready(), wait = deferred();
  routes[previewPath] = () => wait.promise;
  const pending = old.preview();
  while (!writes().length) await new Promise((resolve) => setImmediate(resolve));
  old.release();
  const other = new OverviewChangeController('other-map', base, 4);
  wait.resolve(json(proposal(), 201));
  await pending;
  assert.equal(old.getSnapshot().proposal, null);
  assert.equal(other.getSnapshot().draft, '');
  assert.equal(other.getSnapshot().proposal, null);
  assert.equal(other.getSnapshot().canonical.revision, 4);
});

test('an invalid apply receipt never installs an invented header or loses its recovery identity', async () => {
  const c = await ready();
  await c.preview();
  routes[applyPath] = () => json({ ...receipt(), data: { ...updated, meta: { ...base.meta, oneLineSummary: 'Unauthorized edit' } } });
  await c.apply();
  assert.equal(c.getSnapshot().canonical.data, base);
  assert.equal(c.getSnapshot().retry.kind, 'apply');
  assert.ok(c.getSnapshot().proposal);
  assert.equal(c.getSnapshot().draft, 'Clarify the product audience.');
});

test('post-commit refresh failure preserves confirmed success rather than suggesting another generation', async () => {
  const c = await ready();
  await c.preview();
  routes[applyPath] = () => { routes[`/maps/${mapId}`] = () => failure('temporarily_unavailable', 503); return json(receipt()); };
  await c.apply();
  assert.equal(c.getSnapshot().canonical.revision, 2);
  assert.equal(c.getSnapshot().appliedRevision, 2);
  assert.equal(c.getSnapshot().retry, null);
  assert.equal(c.getSnapshot().refreshRequired, true);
  assert.match(c.getSnapshot().feedback.message, /was applied/);
});

test('artifact caution survives closing review and starting another preview; apply warnings are preserved', async () => {
  const c = await ready();
  await c.preview();
  routes[applyPath] = () => {
    serverMap = { id: mapId, data: updated, revision: 2 };
    return json({ ...receipt(), warnings: [{ code: 'artifact_warning', message: 'Saved documentation is out of date.', sections: ['product'] }] });
  };
  await c.apply();
  assert.equal(c.getSnapshot().appliedWarnings[0].message, 'Saved documentation is out of date.');
  assert.equal(c.getSnapshot().artifactsMayBeStale, true);
  c.discard();
  assert.equal(c.getSnapshot().artifactsMayBeStale, true);
  c.setDraft('Another instruction.');
  routes[previewPath] = () => failure('feature_disabled', 503, 'none');
  await c.preview();
  assert.equal(c.getSnapshot().artifactsMayBeStale, true);
});

test('preflight map failure is distinguished from an uncertain preview and makes no generation request', async () => {
  const c = await ready();
  routes[`/maps/${mapId}`] = () => { throw new TypeError('Disconnected'); };
  await c.preview();
  assert.equal(writes().length, 0);
  assert.equal(c.getSnapshot().retry, null);
  assert.match(c.getSnapshot().feedback.message, /no preview was requested/);
  assert.equal(c.getSnapshot().draft, 'Clarify the product audience.');
});

test('double-clicking approval commits once, and uncertain HTTP 500 retains the same recovery identity', async () => {
  const c = await ready();
  await c.preview();
  routes[applyPath] = () => failure('internal_error', 500, 'none');
  const first = c.apply();
  await c.apply();
  await first;
  assert.equal(writes().filter((x) => x.path === applyPath).length, 1);
  assert.equal(c.getSnapshot().retry.kind, 'apply');
  assert.equal(c.getSnapshot().draft, 'Clarify the product audience.');
  delete routes[applyPath];
  await c.apply(true);
  await c.apply();
  assert.equal(writes().filter((x) => x.path === applyPath).length, 2);
  assert.equal(c.getSnapshot().appliedRevision, 2);
});

test('malformed map bodies and revisionless legacy responses cannot replace accepted canonical data', async () => {
  const c = await ready();
  assert.equal(c.acceptCanonical(mapId, { ...base, architecture: null }, 2), 'invalid');
  c.acceptIteration(updated, undefined, mapId);
  assert.equal(c.getSnapshot().canonical.data, base);
  assert.equal(c.getSnapshot().canonical.revision, 1);
  assert.throws(() => assertOverviewProposal({ ...proposal(), operations: [] }, mapId, 1, base));
});

// Component rendering stays offline, using the same transpile/SSR approach as
// existing logo tests. No new runner, browser script, or test-only app mode.
function composerComponent() {
  const file = new URL('../components/OverviewChangeComposer.tsx', import.meta.url);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const require = createRequire(file), exports = {};
  runInNewContext(code, { exports, require: (name) => name.endsWith('.module.css') ? new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    : name === '@phosphor-icons/react' ? { ArrowRightIcon, CheckIcon }
    : name === './ActionButton' ? { ActionButton: ({ idleLabel, pendingLabel, state, disabled, type = 'button' }) => React.createElement('button', { type, disabled, 'aria-label': state === 'pending' ? pendingLabel : idleLabel }, state === 'pending' ? '' : idleLabel) }
    : require(name) });
  return exports.OverviewChangeComposer;
}
test('review renders actual server diff, warnings, impacts and explicit approval with an accessible input', async () => {
  const c = await ready();
  await c.preview();
  const html = renderToStaticMarkup(React.createElement(composerComponent(), { controller: c, state: c.getSnapshot() }));
  for (const value of [base.product.summary, updated.product.summary, 'Review technical scope separately.', 'source_changed', 'Apply approved change', 'Discard preview', 'Overview pilot']) assert.ok(html.includes(value), value);
  assert.match(html, /<label[^>]*for=/);
  assert.match(html, /<textarea[^>]*maxLength="2000"/i);
  assert.match(html, /<time dateTime=/i);
  assert.ok(!html.includes('A distinct header.'), 'no accidental header edit preview');
  const css = readFileSync(new URL('../components/OverviewChangeComposer.module.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test('transport retains Retry-After, request reference and error classification', async () => {
  routes[previewPath] = () => failure('preview_in_progress', 409, 'same_request', { 'Retry-After': '2' });
  await assert.rejects(previewOverviewChange(mapId, {}, proposalId), (error) => error instanceof ApiError
    && error.retryAfterMs === 2000 && error.body.requestId === 'request-reference' && error.body.retry === 'same_request');
});
