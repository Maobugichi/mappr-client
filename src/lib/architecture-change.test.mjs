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
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { ArrowUpIcon } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise';
const hooks = registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context); throw error; }
} });
process.env.NEXT_PUBLIC_API_URL = 'https://api.mappr.test';
const { OverviewChangeController } = await import('./overview-change.ts');
const { ArchitectureChangeController } = await import('./architecture-change.ts');
const { architectureCandidate, assertArchitectureProposal, assertArchitectureReceipt, emptySystemDiff } = await import('./architecture-change-contract.ts');
const { sameData } = await import('./overview-change-contract.ts');
const { architectureLayoutKey, architectureDisplayBounds } = await import('./architecture-canvas-memory.ts');
const { createTrackedArtifactCache } = await import('./tracked-artifact-cache.ts');
const { rejectArchitectureChange } = await import('./api.ts');
const realFetch = globalThis.fetch;
after(() => { globalThis.fetch = realFetch; hooks.deregister(); });
const mapId = 'ea2c0fb8-b5f0-4ca1-9031-a0a441bcc1fe', proposalId = 'b3e307f0-e66a-4107-b96e-280f1b0e775a';
const web = { id: 'web', label: 'Web app', type: 'frontend', description: 'Existing web UI.' };
const apiNode = { id: 'api-service', label: 'API', type: 'backend', description: 'Existing API.' };
const database = { id: 'db', label: 'Database', type: 'database', description: 'Existing storage.' };
const cacheNode = { id: 'cache', label: 'Cache', type: 'cache', description: 'Proposed cache.' };
const changedApi = { ...apiNode, label: 'Gateway', description: 'Proposed gateway description.' };
const webApi = { from: web.id, to: apiNode.id, label: 'calls' }, apiDb = { from: apiNode.id, to: database.id, label: 'queries' };
const base = { meta: { productName: 'Sample', oneLineSummary: 'Distinct header' }, product: { summary: 'Distinct Overview summary', concepts: [] }, users: [], features: [], techStack: [],
  architecture: { nodes: [web, apiNode, database], edges: [webApi, apiDb] }, dataModel: { entities: [], relations: [] },
  designSystem: { colors: [], typography: [], spacing: [], components: [] }, developmentPlan: [] };
function diff() {
  return { ...emptySystemDiff(), architecture: { nodes: { added: [cacheNode], removed: [database], changed: [{ before: apiNode, after: changedApi, changedFields: ['label', 'description'] }] },
    edges: { added: [{ from: apiNode.id, to: cacheNode.id, label: 'reads cache' }], removed: [apiDb] } } };
}
function proposal(request = { expectedBaseRevision: 1, context: { activeView: 'architecture', selectedTarget: null } }) {
  return { contractVersion: 1, mapId, proposalId, status: 'ready', baseRevision: request.expectedBaseRevision, context: request.context,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString(), summary: 'Replace storage with a cache and rename the API.',
    operations: [{ op: 'server_owned_architecture_operations' }], diff: diff(), affectedSections: ['architecture'],
    warnings: [{ code: 'connection_removed', message: 'The database connection will be removed.', sections: ['architecture'] }],
    artifactImpacts: [{ artifactType: 'deployment', action: 'invalidate', reason: 'source_changed' }] };
}
function receipt(p = proposal(), system = base) {
  return { mapId, proposalId, status: 'applied', previousRevision: p.baseRevision, revision: p.baseRevision + 1, version: p.baseRevision + 1,
    appliedAt: new Date().toISOString(), summary: p.summary, data: architectureCandidate(system, p.diff), diff: p.diff,
    affectedSections: ['architecture'], warnings: p.warnings, artifactFreshness: { deployment: { status: 'stale', sourceRevision: p.baseRevision, reason: 'source_changed' } } };
}
function rejection(baseRevision = 1) {
  return { contractVersion: 1, mapId, proposalId, status: 'rejected', baseRevision, rejectedAt: new Date().toISOString() };
}
function json(value, status = 200, headers = {}) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', Date: new Date().toUTCString(), ...headers } }); }
function failure(error, status = 409, retry = 'none') { return json({ error, message: 'Actual backend explanation.', requestId: 'request-architecture', retry }, status); }
function deferred() { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; }
const previewPath = `/maps/${mapId}/changes/preview`, applyPath = `/maps/${mapId}/changes/${proposalId}/apply`, rejectPath = `/maps/${mapId}/changes/${proposalId}/reject`;
let calls, routes, serverMap, admitted;
beforeEach(() => {
  calls = []; routes = {}; serverMap = { id: mapId, data: base, revision: 1 }; admitted = null;
  globalThis.fetch = async (value, init = {}) => {
    const url = new URL(value); assert.equal(url.origin, 'https://api.mappr.test', 'all HTTP must stay mocked');
    calls.push({ path: url.pathname, init });
    if (routes[url.pathname]) return routes[url.pathname](init);
    if (url.pathname.endsWith('/edit-eligibility')) return json({ mapId, canEdit: true });
    if (url.pathname === `/maps/${mapId}`) return json(serverMap);
    if (url.pathname === previewPath) { admitted = proposal(JSON.parse(init.body)); return json(admitted, 201); }
    if (url.pathname === applyPath) { const r = receipt(admitted ?? proposal(), serverMap.data); serverMap = { id: mapId, data: r.data, revision: r.revision }; return json(r); }
    if (url.pathname === rejectPath) {
      assert.deepEqual(JSON.parse(init.body), { rejected: true, expectedBaseRevision: admitted?.baseRevision ?? 1 });
      return json(rejection(admitted?.baseRevision ?? 1));
    }
    throw new Error('Unexpected mocked request: ' + url.pathname);
  };
});
const writes = () => calls.filter((call) => call.init.method === 'POST');
async function ready() {
  const owner = new OverviewChangeController(mapId, base, 1); owner.retain();
  const changes = new ArchitectureChangeController(owner); changes.retain();
  await changes.activate(); changes.setDraft('Replace storage with a cache and rename the API.');
  return { owner, changes };
}
async function until(path) { while (!calls.some((call) => call.path === path)) await new Promise((resolve) => setImmediate(resolve)); }

// Graph values/order observed through read-only canonical and history-diff GETs
// on 2026-11-13. The envelope below is a mock of the existing frontend contract,
// not a claimed capture of the original failed Apply response. Do not generate
// committed.data with architectureCandidate: that masked this ordering bug.
const redisWeb = { id: 'web', type: 'frontend', label: 'Web app', description: 'Displays tasks.' };
const redisApi = { id: 'api', type: 'backend', label: 'Task API', description: 'Reads and writes tasks.' };
const redisDb = { id: 'db', type: 'database', label: 'PostgreSQL', description: 'Stores tasks.' };
const redisCache = { id: 'cache', type: 'cache', label: 'Redis Cache', description: 'Caches task data for fast retrieval.' };
const redisHttp = { from: 'web', to: 'api', label: 'HTTP' }, redisSql = { from: 'api', to: 'db', label: 'SQL' };
const redisConnection = { from: 'api', to: 'cache', label: 'Cache' };
const redisBase = { ...base, architecture: { nodes: [redisWeb, redisApi, redisDb], edges: [redisHttp, redisSql] } };
const redisCommitted = { ...redisBase, architecture: {
  nodes: [redisWeb, redisApi, redisDb, redisCache], edges: [redisHttp, redisConnection, redisSql],
} };
function redisProposal() {
  return { ...proposal(), summary: 'Updated architecture: 1 node added, 1 edge added.', diff: { ...emptySystemDiff(), architecture: {
    nodes: { added: [redisCache], removed: [], changed: [] }, edges: { added: [redisConnection], removed: [] },
  } } };
}
function redisReceipt() {
  const p = redisProposal();
  return { contractVersion: 1, mapId, proposalId, status: 'applied', previousRevision: 1, revision: 2, version: 2,
    appliedAt: '2026-11-13T11:21:25.585Z', summary: p.summary, data: redisCommitted, diff: p.diff,
    affectedSections: ['architecture'], warnings: p.warnings, artifactFreshness: {
      deployment: { status: 'stale', sourceRevision: 1, reason: 'source_changed' },
    } };
}
async function readyRedis() {
  serverMap = { id: mapId, data: redisBase, revision: 1 };
  const owner = new OverviewChangeController(mapId, redisBase, 1); owner.retain();
  const changes = new ArchitectureChangeController(owner); changes.retain();
  await changes.activate(); changes.setDraft('Add a Redis caching service between the API and database.');
  routes[previewPath] = () => json(redisProposal(), 201);
  return { owner, changes };
}

test('Redis committed graph ordering differs from the client projection but every reviewed field still verifies', () => {
  const p = redisProposal(), committed = redisReceipt();
  const original = JSON.stringify({ data: committed.data, before: redisBase });
  const projected = architectureCandidate(redisBase, p.diff);
  assert.deepEqual(projected.architecture.edges, [redisHttp, redisSql, redisConnection]);
  assert.deepEqual(committed.data.architecture.edges, [redisHttp, redisConnection, redisSql]);
  assert.equal(sameData(committed.data, projected), false, 'the previous final receipt condition rejects the observed committed ordering');
  assert.doesNotThrow(() => assertArchitectureReceipt(committed, p, redisBase));
  assert.doesNotThrow(() => assertArchitectureReceipt({ ...committed, data: { ...redisCommitted, architecture: {
    nodes: [...redisCommitted.architecture.nodes].reverse(), edges: [...redisCommitted.architecture.edges].reverse(),
  } } }, p, redisBase));
  assert.equal(JSON.stringify({ data: committed.data, before: redisBase }), original, 'validation never mutates canonical or receipt ordering');
});

test('Redis Apply resolves successfully once, preserves authoritative edge order and clears pending/recovery actions', async () => {
  const { owner, changes } = await readyRedis(); let commits = 0;
  routes[applyPath] = () => {
    commits++;
    serverMap = { id: mapId, data: redisCommitted, revision: 2 };
    return json(redisReceipt());
  };
  await changes.preview(); assert.equal(owner.getSnapshot().canonical.data, redisBase);
  await changes.apply();
  assert.equal(commits, 1); assert.equal(owner.getRevision(), 2);
  assert.deepEqual(owner.getSnapshot().canonical.data, redisCommitted);
  const state = changes.getSnapshot();
  assert.equal(state.pending, null); assert.equal(state.retry, null); assert.equal(state.proposalIssue, null);
  assert.equal(state.appliedRevision, 2); assert.equal(state.draft, ''); assert.equal(state.feedback.error, false);
  assert.match(state.feedback.message, /Applied at revision 2/); assert.equal(changes.canApply(), false);
  await changes.apply(); await changes.reject();
  assert.equal(writes().filter((call) => call.path === applyPath).length, 1); assert.equal(commits, 1);
  changes.discard(); assert.equal(changes.getSnapshot().proposal, null); assert.equal(owner.getRevision(), 2);
});

test('order-independent Architecture receipt comparison still rejects duplicates, missing identities and unreviewed values', () => {
  const committed = redisReceipt(), p = redisProposal(), a = redisCommitted.architecture;
  const invalidGraphs = [
    { ...a, nodes: [...a.nodes, redisCache] },
    { ...a, nodes: a.nodes.filter((node) => node.id !== 'db') },
    { ...a, nodes: a.nodes.map((node) => node.id === 'cache' ? { ...node, description: 'Unreviewed change' } : node) },
    { ...a, edges: [...a.edges, redisConnection] },
    { ...a, edges: a.edges.filter((edge) => edge.to !== 'db') },
    { ...a, edges: a.edges.map((edge) => edge.to === 'cache' ? { ...edge, label: 'Unreviewed label' } : edge) },
    { ...a, edges: a.edges.map((edge) => edge.to === 'cache' ? { ...edge, from: 'web' } : edge) },
  ];
  for (const graph of invalidGraphs) assert.throws(() => assertArchitectureReceipt({ ...committed, data: { ...redisCommitted, architecture: graph } }, p, redisBase));
  assert.throws(() => assertArchitectureReceipt({ ...committed, data: { ...redisCommitted, product: { ...base.product, summary: 'Unreviewed summary' } } }, p, redisBase));
  assert.throws(() => assertArchitectureReceipt({ ...committed, revision: 3, version: 3 }, p, redisBase));
  assert.throws(() => assertArchitectureReceipt({ ...committed, proposalId: crypto.randomUUID() }, p, redisBase));
});

test('lost Redis approval recovers the same ordered receipt without a second commit or regressing newer canonical state', async () => {
  const { owner, changes } = await readyRedis(); let commits = 0;
  routes[applyPath] = () => {
    commits++;
    serverMap = { id: mapId, data: redisCommitted, revision: 2 };
    throw new TypeError('Committed, but the response was lost');
  };
  await changes.preview(); await changes.apply();
  assert.equal(changes.getSnapshot().retry.kind, 'apply');
  await owner.refreshForArtifacts(); assert.equal(owner.getRevision(), 2);
  const newer = { ...redisCommitted, product: { ...base.product, summary: 'A newer accepted change' } };
  owner.acceptCanonical(mapId, newer, 3); serverMap = { id: mapId, data: newer, revision: 3 };
  routes[applyPath] = () => json(redisReceipt(), 200, { 'Idempotency-Replayed': 'true' });
  await changes.apply(true);
  const approvals = writes().filter((call) => call.path === applyPath);
  assert.equal(approvals.length, 2); assert.equal(approvals[0].init.body, approvals[1].init.body);
  assert.equal(commits, 1); assert.equal(owner.getRevision(), 3); assert.equal(owner.getSnapshot().canonical.data, newer);
  assert.equal(changes.getSnapshot().appliedRevision, 2); assert.equal(changes.getSnapshot().retry, null);
  assert.equal(changes.getSnapshot().artifactFreshness, null); assert.equal(changes.getSnapshot().feedback.error, false);
});

test('whole and selected-node preview send exact context, canonical IDs, revision and fresh UUID identities', async () => {
  const { changes } = await ready();
  await changes.preview();
  assert.deepEqual(JSON.parse(writes()[0].init.body), { instruction: 'Replace storage with a cache and rename the API.', context: { activeView: 'architecture', selectedTarget: null }, expectedBaseRevision: 1 });
  assert.match(writes()[0].init.headers['Idempotency-Key'], /^[0-9a-f-]{36}$/);
  await changes.reject();
  changes.setTarget(apiNode.id);
  await changes.preview();
  const previewWrites = writes().filter((call) => call.path === previewPath);
  assert.deepEqual(JSON.parse(previewWrites[1].init.body).context.selectedTarget, { kind: 'architecture_node', id: apiNode.id });
  assert.notEqual(previewWrites[0].init.headers['Idempotency-Key'], previewWrites[1].init.headers['Idempotency-Key']);
  for (const { init } of calls) { assert.equal(init.credentials, 'include'); assert.equal(init.cache, 'no-store'); assert.equal(init.headers.Origin, undefined); }
});

test('preview and rejection leave the canonical map/graph unchanged; apply atomically updates the shared owner', async () => {
  const { owner, changes } = await ready(), snapshots = [];
  owner.subscribe(() => snapshots.push(owner.getSnapshot().canonical));
  const shape = architectureLayoutKey(base.architecture);
  await changes.preview();
  assert.equal(owner.getSnapshot().canonical.data, base);
  assert.equal(architectureLayoutKey(owner.getSnapshot().canonical.data.architecture), shape);
  assert.equal(changes.getSnapshot().canonical, owner.getSnapshot().canonical);
  await changes.apply();
  const canonical = owner.getSnapshot().canonical;
  assert.equal(canonical.revision, 2);
  assert.equal(changes.getSnapshot().canonical, canonical);
  assert.deepEqual(canonical.data.architecture.nodes, [web, changedApi, cacheNode]);
  assert.equal(canonical.data.product.summary, base.product.summary);
  assert.equal(canonical.data.meta.oneLineSummary, base.meta.oneLineSummary);
  assert.ok(snapshots.every((s) => s.revision === 1 ? s.data === base : s.data.architecture.nodes.some((node) => node.id === 'cache')));
  assert.deepEqual(JSON.parse(writes().find((call) => call.path === applyPath).init.body), { approved: true, expectedBaseRevision: 1 });
  assert.equal(changes.getSnapshot().artifactFreshness.deployment.status, 'stale');
  assert.equal(owner.getSnapshot().artifactsMayBeStale, true);
});

test('a ready proposal needs an explicit decision; discard/new preview cannot silently replace it', async () => {
  const { changes, owner } = await ready();
  await changes.preview();
  changes.discard(); await changes.preview();
  assert.ok(changes.getSnapshot().proposal);
  assert.equal(writes().length, 1);
  await changes.reject();
  assert.equal(changes.getSnapshot().rejected, true);
  assert.equal(changes.canApply(), false);
  assert.equal(changes.getSnapshot().draft, 'Replace storage with a cache and rename the API.');
  assert.equal(owner.getSnapshot().canonical.data, base);
  assert.equal(owner.getSnapshot().canonical.revision, 1);
  changes.discard(); assert.equal(changes.getSnapshot().proposal, null);
});

test('rejection sends the exact confirmation/base revision body and receives the complete HTTP 200 receipt', async () => {
  const confirmed = rejection(7);
  routes[rejectPath] = () => json(confirmed);
  const result = await rejectArchitectureChange(mapId, proposalId, 7);
  assert.deepEqual(result.data, confirmed);
  assert.equal(writes()[0].path, rejectPath);
  assert.deepEqual(JSON.parse(writes()[0].init.body), { rejected: true, expectedBaseRevision: 7 });
  assert.equal(writes()[0].init.credentials, 'include');
  assert.equal(writes()[0].init.cache, 'no-store');
  delete routes[rejectPath];
  const { changes } = await ready(); await changes.preview(); await changes.reject();
  assert.equal(changes.getSnapshot().rejected, true);
});

test('empty or unexpected successful rejection statuses remain uncertain and cannot enable approval', async () => {
  for (const status of [201, 202, 204]) {
    const { changes, owner } = await ready(); await changes.preview();
    routes[rejectPath] = () => status === 204 ? new Response(null, { status }) : json(rejection(), status);
    await changes.reject();
    assert.equal(changes.getSnapshot().rejected, false);
    assert.equal(changes.getSnapshot().pending, null);
    assert.equal(changes.getSnapshot().retry.kind, 'reject');
    assert.ok(changes.getSnapshot().proposal);
    assert.equal(changes.canApply(), false);
    assert.equal(owner.getSnapshot().canonical.data, base);
    assert.equal(owner.getRevision(), 1);
    delete routes[rejectPath]; await changes.reject(true);
    assert.equal(changes.getSnapshot().rejected, true);
  }
});

test('rejection recovery reuses the proposal base revision after a newer canonical revision arrives', async () => {
  const { changes, owner } = await ready(); await changes.preview();
  routes[rejectPath] = () => { throw new TypeError('Lost rejection receipt'); };
  await changes.reject();
  const first = writes().find((call) => call.path === rejectPath);
  const newer = { ...base, product: { ...base.product, summary: 'Newer canonical summary' } };
  owner.acceptCanonical(mapId, newer, 9);
  delete routes[rejectPath]; await changes.reject(true);
  const attempts = writes().filter((call) => call.path === rejectPath);
  assert.equal(attempts.length, 2);
  assert.equal(attempts[1].init.body, first.init.body);
  assert.deepEqual(JSON.parse(first.init.body), { rejected: true, expectedBaseRevision: 1 });
  assert.equal(changes.getSnapshot().rejected, true);
  assert.equal(owner.getRevision(), 9);
  assert.equal(owner.getSnapshot().canonical.data, newer);
  await changes.reject(); await changes.apply();
  assert.equal(writes().filter((call) => call.path === rejectPath).length, 2);
  assert.equal(writes().filter((call) => call.path === applyPath).length, 0);
});

test('scope freezes at Preview click and survives selection/tab changes and same-key recovery', async () => {
  const { changes } = await ready(), wait = deferred();
  changes.setTarget(apiNode.id);
  routes[previewPath] = () => wait.promise;
  const request = changes.preview();
  changes.setTarget(web.id);
  await until(previewPath);
  const body = JSON.parse(writes()[0].init.body);
  assert.equal(body.context.selectedTarget.id, apiNode.id);
  wait.resolve(json(proposal(body), 201)); await request;
  assert.equal(changes.getSnapshot().previewContext.selectedTarget.id, apiNode.id);
  const unsubscribe = changes.subscribe(() => {}); unsubscribe();
  await changes.activate();
  assert.equal(changes.getSnapshot().previewContext.selectedTarget.id, apiNode.id);
  assert.ok(changes.getSnapshot().draft);
});

test('missing, removed, duplicate or display-name targets never silently become whole-architecture requests', async () => {
  const { changes } = await ready();
  for (const id of ['', 'API', 'no-longer-present']) {
    changes.setTarget(id); await changes.preview();
    assert.equal(writes().length, 0);
    assert.match(changes.getSnapshot().feedback.message, /selected canonical node/);
  }
  serverMap = { ...serverMap, data: { ...base, architecture: { ...base.architecture, nodes: [...base.architecture.nodes, apiNode] } }, revision: 2 };
  changes.setTarget(apiNode.id); await changes.preview();
  assert.equal(writes().length, 0);
});

test('concurrent preview/apply/reject clicks are deduplicated and rejection recovery cannot apply', async () => {
  const { changes } = await ready(), wait = deferred();
  routes[previewPath] = () => wait.promise;
  const request = changes.preview(); await changes.preview(); await until(previewPath);
  wait.resolve(json(proposal(), 201)); await request;
  assert.equal(writes().length, 1);
  routes[rejectPath] = () => { throw new TypeError('Lost rejection response'); };
  const rejection = changes.reject(); await changes.reject(); await rejection;
  assert.equal(writes().filter((call) => call.path === rejectPath).length, 1);
  assert.equal(changes.getSnapshot().retry.kind, 'reject');
  await changes.apply(); await changes.preview();
  assert.equal(writes().length, 2);
  delete routes[rejectPath]; await changes.reject(true);
  assert.equal(changes.getSnapshot().rejected, true);
  assert.equal(writes().filter((call) => call.path === rejectPath).length, 2);
});

test('unavailable Architecture responses preserve drafts and never fall back to iterate', async () => {
  const { changes } = await ready();
  for (const code of ['feature_disabled', 'preview_policy_not_configured', 'revision_not_ready']) {
    routes[previewPath] = () => failure(code, 503);
    await changes.preview();
    assert.match(changes.getSnapshot().feedback.message, /Architecture changes are currently unavailable/);
    assert.ok(changes.getSnapshot().draft);
    assert.equal(changes.getSnapshot().proposal, null);
    assert.equal(changes.getSnapshot().pending, null);
  }
  assert.ok(calls.every((call) => !call.path.endsWith('/iterate')));
});

test('rejection recovery respects Retry-After without admitting a separate rejection attempt', async () => {
  const { changes } = await ready(); await changes.preview();
  routes[rejectPath] = () => json({ error: 'temporarily_unavailable', message: 'Retry later.' }, 503, { 'Retry-After': '60' });
  await changes.reject();
  assert.ok(changes.getSnapshot().retry.notBefore > Date.now());
  await changes.reject(); await changes.reject(true); await changes.apply();
  assert.equal(writes().filter((call) => call.path === rejectPath).length, 1);
  assert.equal(writes().filter((call) => call.path === applyPath).length, 0);
});

test('uncertain previews retain exact key/body even after the selected node changes', async () => {
  const { changes } = await ready(); changes.setTarget(apiNode.id);
  routes[previewPath] = () => { throw new TypeError('Lost preview'); };
  await changes.preview(); const first = writes()[0];
  changes.setTarget(web.id); delete routes[previewPath]; await changes.preview(true);
  assert.equal(writes()[1].init.body, first.init.body);
  assert.equal(writes()[1].init.headers['Idempotency-Key'], first.init.headers['Idempotency-Key']);
});

test('reject protocol errors retain a recoverable proposal instead of pretending rejection succeeded', async () => {
  const valid = rejection();
  const invalid = [null, {}, { ...valid, contractVersion: 2 }, { ...valid, mapId: 'another-map' },
    { ...valid, proposalId: 'another-proposal' }, { ...valid, status: 'applied' }, { ...valid, baseRevision: 2 },
    { ...valid, baseRevision: 0 }, { ...valid, baseRevision: '1' }, { ...valid, rejectedAt: 'not-a-date' },
    ...Object.keys(valid).map((key) => Object.fromEntries(Object.entries(valid).filter(([field]) => field !== key)))];
  for (const value of invalid) {
    const { changes, owner } = await ready(); await changes.preview();
    routes[rejectPath] = () => json(value);
    await changes.reject();
    assert.equal(changes.getSnapshot().rejected, false, JSON.stringify(value));
    assert.equal(changes.getSnapshot().retry.kind, 'reject');
    assert.equal(changes.getSnapshot().pending, null);
    assert.equal(owner.getRevision(), 1);
    assert.equal(owner.getSnapshot().canonical.data, base);
    assert.ok(changes.getSnapshot().proposal);
    assert.ok(changes.getSnapshot().draft);
    delete routes[rejectPath]; await changes.reject(true);
    assert.equal(changes.getSnapshot().rejected, true);
  }
});

test('expiry blocks approval, keeps the diff, and server-confirmed expiry permits explicit closure', async () => {
  const { changes } = await ready();
  const expired = { ...proposal(), createdAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() - 10000).toISOString() };
  routes[previewPath] = () => json(expired, 201);
  await changes.preview(); assert.equal(changes.canApply(), false);
  await changes.apply(); assert.equal(writes().length, 1);
  routes[rejectPath] = () => failure('proposal_expired', 410);
  await changes.reject(); assert.equal(changes.getSnapshot().expiredByServer, true);
  assert.ok(changes.getSnapshot().proposal);
  changes.discard(); assert.equal(changes.getSnapshot().proposal, null);
});

test('revision conflicts refresh the single owner and require a new reviewed proposal', async () => {
  const { changes, owner } = await ready(); await changes.preview();
  serverMap = { id: mapId, data: { ...base, product: { ...base.product, summary: 'External edit' } }, revision: 2 };
  routes[applyPath] = () => failure('revision_conflict', 409, 'refresh_map');
  await changes.apply();
  assert.equal(owner.getRevision(), 2);
  assert.equal(changes.getSnapshot().canonical, owner.getSnapshot().canonical);
  assert.equal(changes.canApply(), false);
  assert.match(changes.getSnapshot().proposalIssue, /new preview/);
  assert.equal(writes().filter((call) => call.path === applyPath).length, 1);
});

test('lost apply recovery/replayed old receipt cannot regress newer canonical or artifact state', async () => {
  const { changes, owner } = await ready(); await changes.preview();
  routes[applyPath] = () => { throw new TypeError('Lost apply'); }; await changes.apply();
  const newer = { ...base, product: { ...base.product, summary: 'Newest independent summary' } };
  owner.acceptCanonical(mapId, newer, 9); serverMap = { id: mapId, data: newer, revision: 9 };
  routes[applyPath] = () => json(receipt(), 200, { 'Idempotency-Replayed': 'true' });
  await changes.apply(true);
  assert.equal(owner.getRevision(), 9);
  assert.equal(owner.getSnapshot().canonical.data, newer);
  assert.equal(changes.getSnapshot().appliedRevision, 2);
  assert.equal(changes.getSnapshot().artifactFreshness, null);
  assert.match(changes.getSnapshot().feedback.message, /Newer revision 9/);
});

test('owner loss invalidates authorization-bound proposals in both composers', async () => {
  const { changes, owner } = await ready(); await changes.preview();
  routes[`/maps/${mapId}/edit-eligibility`] = () => failure('session_required', 401);
  await changes.apply();
  assert.equal(changes.getSnapshot().eligibility, 'denied'); assert.equal(owner.getSnapshot().eligibility, 'denied');
  assert.equal(changes.getSnapshot().proposal, null); assert.equal(changes.getSnapshot().pending, null);
  assert.equal(owner.getSnapshot().canonical.data, base);
  assert.equal(writes().filter((call) => call.path === applyPath).length, 0);
  delete routes[`/maps/${mapId}/edit-eligibility`];
  await changes.activate();
  assert.equal(changes.getSnapshot().eligibility, 'owner');
  assert.equal(owner.getSnapshot().eligibility, 'owner');
  assert.equal(changes.getSnapshot().proposal, null, 'reauthentication must not revive an authorization-bound proposal');
});

test('map unmount discards late responses without leaking drafts or previews into another workspace', async () => {
  const { changes } = await ready(), wait = deferred(); routes[previewPath] = () => wait.promise;
  const request = changes.preview(); await until(previewPath); changes.release();
  const otherOwner = new OverviewChangeController('another-map', base, 3), other = new ArchitectureChangeController(otherOwner); other.retain();
  wait.resolve(json(proposal(), 201)); await request;
  assert.equal(changes.getSnapshot().proposal, null); assert.equal(other.getSnapshot().proposal, null); assert.equal(other.getSnapshot().draft, '');
});

test('diff validation includes connection removals and rejects hidden cascades, out-of-scope and mismatched changes', () => {
  assert.deepEqual(architectureCandidate(base, diff()).architecture.edges, [webApi, { from: apiNode.id, to: cacheNode.id, label: 'reads cache' }]);
  const invalid = [
    { ...diff(), product: { ...emptySystemDiff().product, summary: [{ field: 'summary', before: 'A', after: 'B' }] } },
    { ...diff(), architecture: { ...diff().architecture, edges: { ...diff().architecture.edges, removed: [] } } },
    { ...diff(), architecture: { ...diff().architecture, nodes: { ...diff().architecture.nodes, changed: [{ before: { ...apiNode, label: 'False baseline' }, after: changedApi, changedFields: ['label'] }] } } },
    { ...diff(), architecture: { ...diff().architecture, edges: { ...diff().architecture.edges, added: [{ from: 'missing', to: 'cache' }] } } },
    emptySystemDiff(), { architecture: diff().architecture, hasChanges: true },
  ];
  for (const d of invalid) assert.throws(() => architectureCandidate(base, d));
  assert.throws(() => assertArchitectureProposal({ ...proposal(), context: { activeView: 'architecture', selectedTarget: { kind: 'architecture_node', id: 'wrong' } } }, mapId, 1, base,
    { instruction: 'Edit', expectedBaseRevision: 1, context: { activeView: 'architecture', selectedTarget: null } }));
});

test('mismatched receipts cannot install unreviewed changes or falsely clear the draft', async () => {
  const { changes, owner } = await ready(); await changes.preview();
  routes[applyPath] = () => json({ ...receipt(), data: { ...receipt().data, product: { ...base.product, summary: 'Unreviewed edit' } } });
  await changes.apply(); assert.equal(owner.getRevision(), 1); assert.equal(changes.getSnapshot().retry.kind, 'apply'); assert.ok(changes.getSnapshot().draft);
});

test('Architecture Apply invalidates old S5 scopes and accepts fresh artifacts only in the replacement revision', async () => {
  const { changes, owner } = await ready();
  const authority = { revision: owner.getRevision, refresh: async () => {} };
  const oldCache = createTrackedArtifactCache(mapId, base, authority);
  const metadata = (currentRevision) => ({ mapId, currentRevision, sourceRevision: 1, readMode: 'tracked', isCurrent: true, inspectionOnly: false,
    freshness: { status: 'fresh', reason: 'inputs_unchanged' }, endpoints: [] });
  await oldCache.getTracked('api_contract').ensureLoaded(async () => metadata(1));
  await changes.preview(); await changes.apply();
  await oldCache.getTracked('api_contract').reload(async () => metadata(2));
  assert.equal(oldCache.getTracked('api_contract').getSnapshot().status, 'unavailable');
  const freshCache = createTrackedArtifactCache(mapId, owner.getSnapshot().canonical.data, authority);
  await freshCache.getTracked('api_contract').ensureLoaded(async () => metadata(2));
  assert.equal(freshCache.getTracked('api_contract').getSnapshot().status, 'current');
});

test('node metadata and selection do not change layout keys; manual positions are included in fit bounds', () => {
  assert.equal(architectureLayoutKey(base.architecture), architectureLayoutKey({ ...base.architecture, nodes: base.architecture.nodes.map((n) => ({ ...n, label: n.label + ' revised', description: 'Changed', type: 'Changed' })) }));
  assert.notEqual(architectureLayoutKey(base.architecture), architectureLayoutKey(architectureCandidate(base, diff()).architecture));
  const bounds = architectureDisplayBounds({ x: 0, y: 0, width: 500, height: 500 }, [{ id: 'api-service', position: { x: 0, y: 0 }, data: {}, style: { width: 220, height: 84 } }], { 'api-service': { x: -100, y: 600 } });
  assert.ok(bounds.x <= -100); assert.ok(bounds.y + bounds.height >= 684);
});

const compiled = new Map();
function component(file) {
  if (compiled.has(file)) return compiled.get(file);
  const url = new URL('../components/' + file + '.tsx', import.meta.url), require = createRequire(url), result = {};
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(code, { exports: result, require: (name) => name.endsWith('.module.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    : name === '@phosphor-icons/react' ? { ArrowRightIcon, CheckIcon, XIcon, ArrowUpIcon, ClockCounterClockwiseIcon }
    : name === '@/lib/api' ? { getVersions: async () => [] }
    : name === './OverviewChangeComposer' ? component('OverviewChangeComposer')
    : name === './ActionButton' ? { ActionButton: ({ idleLabel, pendingLabel, state, disabled, type = 'button' }) => React.createElement('button', { type, disabled, 'aria-label': state === 'pending' ? pendingLabel : idleLabel }, state === 'pending' ? '' : idleLabel) }
    : require(name) });
  compiled.set(file, result); return result;
}
test('actual interface renders full server node/edge changes, removed connections, scope, warnings and explicit decisions', async () => {
  const { changes } = await ready(); changes.setTarget(apiNode.id); await changes.preview();
  const html = renderToStaticMarkup(React.createElement(component('ArchitectureChangeComposer').ArchitectureChangeComposer, {
    controller: changes, state: changes.getSnapshot(), selectedNode: web, targetMode: 'selected', onTargetMode() {},
  }));
  for (const text of ['Describe a Change', 'Change scope', 'Whole architecture', 'Selected node', 'Added nodes', 'Updated nodes', 'Removed nodes',
    'Added connections', 'Removed connections', apiDb.label, apiNode.description, changedApi.description, cacheNode.description, 'Reject proposal', 'Apply approved change', 'source_changed', 'The database connection will be removed.']) assert.ok(html.includes(text), text);
  assert.match(html, /canonical node <code[^>]*>api-service<\/code>/);
  assert.match(html, /type="radio"/); assert.match(html, /<time dateTime=/i);
  assert.ok(!html.includes('Discard preview'));
});

test('history is retained while Architecture editing cannot invoke the immediate legacy submission path', () => {
  const source = readFileSync(new URL('../components/ArchitectureCanvas.tsx', import.meta.url), 'utf8');
  assert.match(source, /historyOnly/); assert.ok(!source.includes('runIteration'));
  const history = renderToStaticMarkup(React.createElement(component('IterationBar').IterationBar, { historyOnly: true, mapId, isRunning: false, error: null, lastSummary: null, refreshKey: 1, onCompare() {}, isDiffing: false }));
  assert.match(history, /Version history/); assert.ok(!history.includes('<input')); assert.ok(!history.includes('Apply change'));
});
