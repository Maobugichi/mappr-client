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

const hooks = registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context); throw error; }
} });
process.env.NEXT_PUBLIC_API_URL = 'https://api.mappr.test';
const { OverviewChangeController } = await import('./overview-change.ts');
const { ArchitectureChangeController } = await import('./architecture-change.ts');
const { TechStackChangeController } = await import('./tech-stack-change.ts');
const { techStackCandidate, assertTechStackProposal } = await import('./tech-stack-change-contract.ts');
const { emptySystemDiff } = await import('./change-protocol.ts');
const { createTrackedArtifactCache } = await import('./tracked-artifact-cache.ts');
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; hooks.deregister(); });

const mapId = 'ea2c0fb8-b5f0-4ca1-9031-a0a441bcc1fe', proposalId = 'b3e307f0-e66a-4107-b96e-280f1b0e775a';
const frontend = { category: 'Frontend', choice: 'Next.js on Vercel', rationale: 'Existing frontend rationale.' };
const lowerFrontend = { category: 'frontend', choice: 'React', rationale: 'A distinct case-sensitive category.' };
const database = { category: 'Data & Storage', choice: 'PostgreSQL', rationale: 'Existing relational storage rationale.' };
const queue = { category: 'Jobs', choice: 'Redis', rationale: 'Existing background work rationale.' };
const revisedFrontend = { ...frontend, rationale: 'Complete revised rationale.\nA second line is preserved.' };
const revisedDatabase = { ...database, choice: 'SQLite', rationale: 'Complete proposed storage rationale.' };
const renamedQueue = { ...queue, category: 'Background processing' };
const base = { meta: { productName: 'Sample', oneLineSummary: 'Existing header' }, product: { summary: 'Existing Overview summary', concepts: [] },
  users: [], features: [], techStack: [frontend, lowerFrontend, database, queue],
  architecture: { nodes: [{ id: 'api', label: 'API', type: 'backend', description: 'Existing architecture node.' }], edges: [] },
  dataModel: { entities: [], relations: [] }, designSystem: { colors: [], typography: [], spacing: [], components: [] }, developmentPlan: [] };
const context = { activeView: 'tech-stack', selectedTarget: null };
const instruction = 'Revise the technology rationale, storage choice, and background category.';
function diff() {
  return { ...emptySystemDiff(), techStack: { added: [renamedQueue], removed: [queue], changed: [
    { before: frontend, after: revisedFrontend, changedFields: ['rationale'] },
    { before: database, after: revisedDatabase, changedFields: ['choice', 'rationale'] },
  ] } };
}
function proposal(request = { context, expectedBaseRevision: 1 }) {
  return { contractVersion: 1, mapId, proposalId, status: 'ready', baseRevision: request.expectedBaseRevision, context: request.context,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString(), summary: 'Revise storage and its rationale; rename the background category.',
    operations: [{ op: 'server_owned_operations' }], diff: diff(), affectedSections: ['techStack'],
    warnings: [{ code: 'review_compatibility', message: 'Review compatibility with the existing architecture.', sections: ['architecture', 'techStack'] }],
    artifactImpacts: [{ artifactType: 'deployment', action: 'invalidate', reason: 'source_changed' }] };
}
function receipt(p = proposal()) {
  return { mapId, proposalId, status: 'applied', previousRevision: p.baseRevision, revision: p.baseRevision + 1, version: p.baseRevision + 1,
    appliedAt: new Date().toISOString(), summary: p.summary, data: techStackCandidate(base, p.diff), diff: p.diff,
    affectedSections: ['techStack'], warnings: p.warnings, artifactFreshness: { deployment: { status: 'stale', sourceRevision: p.baseRevision, reason: 'source_changed' } } };
}
function rejection(baseRevision = 1) { return { contractVersion: 1, mapId, proposalId, status: 'rejected', baseRevision, rejectedAt: new Date().toISOString() }; }
function json(value, status = 200, headers = {}) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', Date: new Date().toUTCString(), ...headers } }); }
function failure(error, status = 409, retry = 'none', headers = {}) { return json({ error, message: 'Actual server explanation.', requestId: 'request-tech-stack', retry }, status, headers); }
function deferred() { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; }
const previewPath = `/maps/${mapId}/changes/preview`, applyPath = `/maps/${mapId}/changes/${proposalId}/apply`, rejectPath = `/maps/${mapId}/changes/${proposalId}/reject`;
let calls, routes, serverMap, admitted;
beforeEach(() => {
  calls = []; routes = {}; admitted = null; serverMap = { id: mapId, data: base, revision: 1 };
  globalThis.fetch = async (value, init = {}) => {
    const url = new URL(value); assert.equal(url.origin, 'https://api.mappr.test', 'all HTTP stays mocked');
    calls.push({ path: url.pathname, init });
    if (routes[url.pathname]) return routes[url.pathname](init);
    if (url.pathname.endsWith('/edit-eligibility')) return json({ mapId, canEdit: true });
    if (url.pathname === `/maps/${mapId}`) return json(serverMap);
    if (url.pathname === previewPath) { admitted = proposal(JSON.parse(init.body)); return json(admitted, 201); }
    if (url.pathname === applyPath) { const r = receipt(admitted ?? proposal()); serverMap = { id: mapId, data: r.data, revision: r.revision }; return json(r); }
    if (url.pathname === rejectPath) {
      assert.deepEqual(JSON.parse(init.body), { rejected: true, expectedBaseRevision: admitted?.baseRevision ?? 1 });
      return json(rejection(admitted?.baseRevision ?? 1));
    }
    throw new Error('Unexpected mocked route: ' + url.pathname);
  };
});
const writes = (path) => calls.filter((call) => call.init.method === 'POST' && (!path || call.path === path));
async function ready() {
  const owner = new OverviewChangeController(mapId, base, 1); owner.retain();
  const architecture = new ArchitectureChangeController(owner); architecture.retain();
  const changes = new TechStackChangeController(owner); changes.retain();
  await changes.activate(); changes.setDraft(instruction);
  return { owner, architecture, changes };
}
async function until(path) {
  const deadline = Date.now() + 2000;
  while (!calls.some((call) => call.path === path)) {
    assert.ok(Date.now() < deadline, 'expected request was sent');
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test('preview uses tech-stack/null context, accepted revision, exact instruction and a fresh UUID for each distinct request', async () => {
  const { changes } = await ready(); await changes.preview();
  const first = writes(previewPath)[0];
  assert.deepEqual(JSON.parse(first.init.body), { instruction, context, expectedBaseRevision: 1 });
  assert.match(first.init.headers['Idempotency-Key'], /^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  await changes.reject(); await changes.preview();
  assert.notEqual(writes(previewPath)[1].init.headers['Idempotency-Key'], first.init.headers['Idempotency-Key']);
  for (const { init } of calls) {
    assert.equal(init.credentials, 'include'); assert.equal(init.cache, 'no-store');
    assert.equal(init.headers.Origin, undefined); assert.equal(init.headers.Cookie, undefined);
  }
});

test('preview is immutable; Apply atomically updates the single canonical owner and Architecture subscriber', async () => {
  const { owner, architecture, changes } = await ready(), snapshots = [];
  owner.subscribe(() => snapshots.push(owner.getSnapshot().canonical));
  await changes.preview();
  assert.equal(owner.getSnapshot().canonical.data, base); assert.equal(changes.getRevision(), 1);
  await changes.apply();
  const canonical = owner.getSnapshot().canonical;
  assert.equal(canonical.revision, 2);
  assert.deepEqual(canonical.data.techStack, [revisedFrontend, lowerFrontend, revisedDatabase, renamedQueue]);
  assert.equal(changes.getSnapshot().canonical, canonical); assert.equal(architecture.getSnapshot().canonical, canonical);
  assert.deepEqual(canonical.data.architecture, base.architecture); assert.deepEqual(canonical.data.product, base.product);
  assert.deepEqual(JSON.parse(writes(applyPath)[0].init.body), { approved: true, expectedBaseRevision: 1 });
  assert.ok(snapshots.every((s) => s.revision === 1 ? s.data === base : s.data.techStack[0].rationale === revisedFrontend.rationale));
  assert.equal(changes.getSnapshot().artifactFreshness.deployment.status, 'stale');
  assert.equal(changes.getSnapshot().draft, ''); assert.equal(owner.getSnapshot().artifactsMayBeStale, true);
});

test('category identity is exact and case-sensitive; rationale-only changes and remove/add renames are supported', () => {
  const candidate = techStackCandidate(base, diff());
  assert.deepEqual(candidate.techStack[1], lowerFrontend);
  assert.equal(candidate.techStack[0].choice, frontend.choice);
  assert.equal(candidate.techStack[0].rationale, revisedFrontend.rationale);
  assert.equal(candidate.techStack.some((item) => item.category === 'Jobs'), false);
  assert.deepEqual(candidate.techStack.at(-1), renamedQueue);
  const casingRename = { ...emptySystemDiff(), techStack: { added: [{ ...queue, category: 'jobs' }], removed: [queue], changed: [] } };
  assert.equal(techStackCandidate(base, casingRename).techStack.at(-1).category, 'jobs');
  const future = { category: 'A future role / vNext', choice: 'A generated tool', rationale: 'Actual server rationale.' };
  assert.deepEqual(techStackCandidate(base, { ...emptySystemDiff(), techStack: { added: [future], removed: [], changed: [] } }).techStack.at(-1), future);
});

test('inconsistent, ambiguous, no-op, renamed-in-place and out-of-scope diffs fail closed', () => {
  const invalid = [emptySystemDiff(), { techStack: diff().techStack, hasChanges: true },
    { ...diff(), architecture: { nodes: { added: [{ id: 'other' }], removed: [], changed: [] }, edges: { added: [], removed: [] } } },
    { ...diff(), techStack: { ...diff().techStack, removed: [{ ...queue, category: 'jobs' }] } },
    { ...diff(), techStack: { ...diff().techStack, added: [renamedQueue, renamedQueue] } },
    { ...diff(), techStack: { ...diff().techStack, added: [frontend] } },
    { ...diff(), techStack: { ...diff().techStack, added: [{ ...renamedQueue, id: 'invented-id' }] } },
    { ...diff(), techStack: { added: [], removed: [], changed: [{ before: queue, after: renamedQueue, changedFields: ['category'] }] } },
    { ...diff(), techStack: { added: [], removed: [], changed: [{ before: frontend, after: revisedFrontend, changedFields: ['choice'] }] } },
    { ...diff(), techStack: { added: [], removed: [], changed: [{ before: frontend, after: revisedFrontend, changedFields: ['rationale', 'rationale'] }] } },
    { ...diff(), techStack: { added: [], removed: [], changed: [{ before: { ...frontend, rationale: 'Wrong before' }, after: revisedFrontend, changedFields: ['rationale'] }] } },
  ];
  for (const value of invalid) assert.throws(() => techStackCandidate(base, value));
  assert.throws(() => techStackCandidate({ ...base, techStack: [...base.techStack, frontend] }, diff()));
});

test('duplicate canonical categories block generation without dropping or renaming inventory entries', async () => {
  const { owner, changes } = await ready();
  serverMap = { id: mapId, data: { ...base, techStack: [...base.techStack, frontend] }, revision: 2 };
  await changes.preview(); assert.equal(writes().length, 0);
  assert.equal(owner.getSnapshot().canonical.data.techStack.length, 5);
  assert.match(changes.getSnapshot().feedback.message, /unambiguously/);
});

test('mismatched server proposal scope/context cannot enable approval', async () => {
  const { changes } = await ready();
  for (const value of [{ ...proposal(), affectedSections: ['architecture'] }, { ...proposal(), context: { activeView: 'tech-stack', selectedTarget: { kind: 'technology', id: 'fake' } } }]) {
    routes[previewPath] = () => json(value, 201); await changes.preview();
    assert.equal(changes.getSnapshot().proposal, null); assert.equal(changes.canApply(), false);
  }
  assert.throws(() => assertTechStackProposal(proposal(), mapId, 3, base, { instruction, context, expectedBaseRevision: 3 }));
});

test('a ready proposal requires explicit Apply/Reject; confirmed rejection preserves canonical data and the draft', async () => {
  const { changes, owner } = await ready(); await changes.preview();
  changes.discard(); await changes.preview(); assert.equal(writes(previewPath).length, 1);
  await changes.reject();
  assert.deepEqual(JSON.parse(writes(rejectPath)[0].init.body), { rejected: true, expectedBaseRevision: 1 });
  assert.equal(changes.getSnapshot().rejected, true); assert.equal(changes.getSnapshot().draft, instruction);
  assert.equal(owner.getSnapshot().canonical.data, base); assert.equal(owner.getRevision(), 1);
  await changes.reject(); await changes.apply();
  assert.equal(writes(rejectPath).length, 1); assert.equal(writes(applyPath).length, 0);
  changes.discard(); assert.equal(changes.getSnapshot().proposal, null);
});

test('lost previews reuse their captured body/key; intentional new requests receive fresh keys', async () => {
  const { changes } = await ready(); routes[previewPath] = () => { throw new TypeError('Lost preview response'); };
  await changes.preview(); const first = writes(previewPath)[0]; changes.setDraft('Another draft');
  delete routes[previewPath]; await changes.preview(true);
  assert.equal(writes(previewPath)[1].init.body, first.init.body);
  assert.equal(writes(previewPath)[1].init.headers['Idempotency-Key'], first.init.headers['Idempotency-Key']);
  await changes.reject(); await changes.preview();
  assert.notEqual(writes(previewPath)[2].init.headers['Idempotency-Key'], first.init.headers['Idempotency-Key']);
});

test('duplicate submissions are blocked and pending outcomes survive view subscriptions', async () => {
  const { changes } = await ready(), wait = deferred(); routes[previewPath] = () => wait.promise;
  const request = changes.preview(); await changes.preview(); await until(previewPath);
  const unsubscribe = changes.subscribe(() => {}); unsubscribe();
  wait.resolve(json(proposal(), 201)); await request;
  assert.equal(writes(previewPath).length, 1); assert.ok(changes.getSnapshot().proposal);
  const applyWait = deferred(); routes[applyPath] = () => applyWait.promise;
  const apply = changes.apply(); await changes.apply(); await until(applyPath);
  const applied = receipt(); serverMap = { id: mapId, data: applied.data, revision: 2 };
  applyWait.resolve(json(applied)); await apply;
  assert.equal(writes(applyPath).length, 1);
});

test('unavailable editing and daily allowance errors preserve drafts and display actual server errors without iteration fallback', async () => {
  const { changes, owner } = await ready();
  for (const [code, status] of [['feature_disabled', 503], ['preview_policy_not_configured', 503], ['unsupported_scope', 422], ['daily_limit_exceeded', 429], ['attempt_limit_exceeded', 429]]) {
    routes[previewPath] = () => failure(code, status); await changes.preview();
    assert.equal(changes.getSnapshot().pending, null); assert.equal(changes.getSnapshot().retry, null);
    assert.equal(changes.getSnapshot().draft, instruction); assert.equal(changes.getSnapshot().proposal, null);
    assert.match(changes.getSnapshot().feedback.message, new RegExp(code));
    assert.equal(changes.getSnapshot().feedback.requestId, 'request-tech-stack');
    assert.equal(owner.getSnapshot().canonical.data, base);
  }
  assert.ok(calls.every((call) => !call.path.endsWith('/iterate')));
});

test('Retry-After preserves the same request identity without automatic retries', async () => {
  const { changes } = await ready(); routes[previewPath] = () => failure('preview_in_progress', 409, 'same_request', { 'Retry-After': '60' });
  await changes.preview(); assert.ok(changes.getSnapshot().retry.notBefore > Date.now());
  await changes.preview(true); assert.equal(writes(previewPath).length, 1);
});

test('rejection uses the original proposal revision on recovery and never replaces a newer canonical map', async () => {
  const { changes, owner } = await ready(); await changes.preview();
  routes[rejectPath] = () => { throw new TypeError('Lost rejection'); }; await changes.reject();
  await changes.preview(); await changes.apply(); assert.equal(writes().length, 2);
  const newer = { ...base, product: { ...base.product, summary: 'Newer canonical summary' } };
  owner.acceptCanonical(mapId, newer, 9);
  delete routes[rejectPath]; await changes.reject(true);
  assert.equal(writes(rejectPath)[0].init.body, writes(rejectPath)[1].init.body);
  assert.equal(JSON.parse(writes(rejectPath)[1].init.body).expectedBaseRevision, 1);
  assert.equal(changes.getSnapshot().rejected, true); assert.equal(owner.getRevision(), 9);
  assert.equal(owner.getSnapshot().canonical.data, newer);
});

test('204 or mismatched rejection receipts retain recovery and block Apply', async () => {
  for (const response of [() => new Response(null, { status: 204 }), () => json({ ...rejection(), baseRevision: 2 })]) {
    const { changes } = await ready(); await changes.preview(); routes[rejectPath] = response;
    await changes.reject(); assert.equal(changes.getSnapshot().rejected, false);
    assert.equal(changes.getSnapshot().retry.kind, 'reject'); assert.equal(changes.canApply(), false);
    delete routes[rejectPath]; await changes.reject(true); assert.equal(changes.getSnapshot().rejected, true);
  }
});

test('lost approval recovery works after expiry and cannot overwrite newer canonical or artifact state', async () => {
  const { changes, owner } = await ready(); await changes.preview(); const applied = receipt();
  routes[applyPath] = () => { throw new TypeError('Lost apply'); }; await changes.apply();
  const newer = { ...base, product: { ...base.product, summary: 'Newer map' } };
  owner.acceptCanonical(mapId, newer, 9); serverMap = { id: mapId, data: newer, revision: 9 };
  changes.getSnapshot().proposal.expiresAt = new Date(Date.now() - 10000).toISOString();
  routes[applyPath] = () => json(applied, 200, { 'Idempotency-Replayed': 'true' }); await changes.apply(true);
  assert.equal(writes(applyPath)[0].init.body, writes(applyPath)[1].init.body);
  assert.equal(owner.getRevision(), 9); assert.equal(owner.getSnapshot().canonical.data, newer);
  assert.equal(changes.getSnapshot().appliedRevision, 2); assert.equal(changes.getSnapshot().artifactFreshness, null);
  assert.match(changes.getSnapshot().feedback.message, /Newer revision 9/);
});

test('an apply receipt with unreviewed changes remains uncertain and cannot mutate the shared map', async () => {
  const { changes, owner } = await ready(); await changes.preview(); const applied = receipt();
  routes[applyPath] = () => json({ ...applied, data: { ...applied.data, product: { ...base.product, summary: 'Hidden change' } } });
  await changes.apply(); assert.equal(owner.getRevision(), 1); assert.equal(owner.getSnapshot().canonical.data, base);
  assert.equal(changes.getSnapshot().retry.kind, 'apply'); assert.equal(changes.getSnapshot().draft, instruction);
  await changes.reject(); await changes.preview(); assert.equal(writes().length, 2);
});

test('revision conflicts refresh the shared map without rebasing or silently applying the old proposal', async () => {
  const { changes, owner } = await ready(); await changes.preview();
  serverMap = { id: mapId, data: { ...base, product: { ...base.product, summary: 'External edit' } }, revision: 2 };
  routes[applyPath] = () => failure('revision_conflict', 409, 'refresh_map'); await changes.apply();
  assert.equal(owner.getRevision(), 2); assert.equal(changes.canApply(), false); assert.ok(changes.getSnapshot().proposal);
  assert.equal(changes.getSnapshot().draft, instruction); assert.equal(writes(applyPath).length, 1);
  await changes.reject(); assert.equal(changes.getSnapshot().rejected, true);
});

test('expired proposals remain inspectable but unapprovable; server-confirmed expiry permits explicit closure', async () => {
  const { changes } = await ready(); routes[previewPath] = () => json({ ...proposal(), createdAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() - 10000).toISOString() }, 201);
  await changes.preview(); await changes.apply(); assert.equal(changes.canApply(), false); assert.equal(writes(applyPath).length, 0);
  routes[rejectPath] = () => failure('proposal_expired', 410); await changes.reject();
  assert.equal(changes.getSnapshot().expiredByServer, true); assert.ok(changes.getSnapshot().proposal);
  changes.discard(); assert.equal(changes.getSnapshot().proposal, null);
});

test('authorization is rechecked before rejection and loss clears proposals across the workspace', async () => {
  const { changes, owner, architecture } = await ready(); await changes.preview();
  routes[`/maps/${mapId}/edit-eligibility`] = () => failure('session_required', 401);
  await changes.reject(); assert.equal(writes(rejectPath).length, 0);
  for (const controller of [changes, owner, architecture]) assert.equal(controller.getSnapshot().eligibility, 'denied');
  assert.equal(changes.getSnapshot().proposal, null); assert.equal(changes.getSnapshot().draft, instruction);
  delete routes[`/maps/${mapId}/edit-eligibility`]; await changes.activate();
  assert.equal(owner.getSnapshot().eligibility, 'owner'); assert.equal(changes.getSnapshot().proposal, null);
});

test('missing revisions prevent generation and unmounted map responses cannot leak into another workspace', async () => {
  const { changes } = await ready(); serverMap = { id: mapId, data: base }; await changes.preview(); assert.equal(writes().length, 0);
  serverMap = { id: mapId, data: base, revision: 1 }; const wait = deferred(); routes[previewPath] = () => wait.promise;
  const request = changes.preview(); await until(previewPath); changes.release();
  const other = new TechStackChangeController(new OverviewChangeController('another-map', base, 4)); other.retain();
  wait.resolve(json(proposal(), 201)); await request;
  assert.equal(changes.getSnapshot().proposal, null); assert.equal(other.getSnapshot().proposal, null); assert.equal(other.getSnapshot().draft, '');
});

test('Apply invalidates previous S5 artifact/export scopes without treating receipt freshness as a fresh artifact', async () => {
  const { changes, owner } = await ready(), authority = { revision: owner.getRevision, refresh: async () => {} };
  const oldCache = createTrackedArtifactCache(mapId, base, authority);
  const metadata = (revision) => ({ mapId, currentRevision: revision, sourceRevision: 1, readMode: 'tracked', isCurrent: true, inspectionOnly: false,
    freshness: { status: 'fresh', reason: 'inputs_unchanged' }, endpoints: [] });
  await oldCache.getTracked('api_contract').ensureLoaded(async () => metadata(1));
  await changes.preview(); await changes.apply();
  assert.equal(owner.getSnapshot().artifactsMayBeStale, true);
  await oldCache.getTracked('api_contract').reload(async () => metadata(2));
  assert.equal(oldCache.getTracked('api_contract').getSnapshot().status, 'unavailable');
  const current = createTrackedArtifactCache(mapId, owner.getSnapshot().canonical.data, authority);
  await current.getTracked('api_contract').ensureLoaded(async () => metadata(2));
  assert.equal(current.getTracked('api_contract').getSnapshot().status, 'current');
});

const compiled = new Map();
function component(file) {
  if (compiled.has(file)) return compiled.get(file);
  const url = new URL('../components/' + file + '.tsx', import.meta.url), require = createRequire(url), result = {};
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(code, { exports: result, require: (name) => name.endsWith('.module.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    : name === '@phosphor-icons/react' ? { ArrowRightIcon, CheckIcon, XIcon }
    : name === './OverviewChangeComposer' ? component('OverviewChangeComposer')
    : name === './TechnologyLogo' ? { TechnologyLogo: () => React.createElement('span', { 'aria-hidden': true }) }
    : name === './ActionButton' ? { ActionButton: ({ idleLabel, pendingLabel, state, disabled, type = 'button' }) => React.createElement('button', { type, disabled, 'aria-label': state === 'pending' ? pendingLabel : idleLabel }, state === 'pending' ? '' : idleLabel) }
    : require(name) });
  compiled.set(file, result); return result;
}

test('actual shared UI renders complete Tech Stack before/after fields, rationale-only updates, additions/removals and decisions', async () => {
  const { changes } = await ready(); await changes.preview();
  const html = renderToStaticMarkup(React.createElement(component('TechStackChangeComposer').TechStackChangeComposer, { controller: changes, state: changes.getSnapshot() }));
  for (const value of ['Describe a Change', 'Tech Stack', 'Added technologies', 'Updated technologies', 'Removed technologies',
    'Before', 'Proposed', 'Changed: rationale', frontend.rationale, revisedFrontend.rationale, revisedDatabase.choice, queue.category, renamedQueue.category,
    'Apply approved change', 'Reject proposal', 'Review compatibility', 'Predicted artifact impacts', 'source_changed']) assert.ok(html.includes(value), value);
  assert.match(html, /<time dateTime=/i); assert.match(html, /<textarea[^>]*id=/);
  assert.ok(!html.includes('Discard preview')); assert.ok(!html.includes('Selected node'));
});

test('inventory retains its compact full-content presentation with each technology name appearing once', () => {
  const html = renderToStaticMarkup(React.createElement(component('TechStackView').TechStackView, { techStack: base.techStack }));
  assert.equal((html.match(/<h3/g) ?? []).length, base.techStack.length);
  for (const item of base.techStack) { assert.ok(html.includes(item.choice)); assert.ok(html.includes(item.rationale)); }
  assert.ok(!html.includes('<button')); assert.ok(!html.includes('<details')); assert.ok(!html.includes('inspector'));
});
