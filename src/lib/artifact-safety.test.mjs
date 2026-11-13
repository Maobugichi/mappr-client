import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { registerHooks, createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';
import { WarningIcon } from '@phosphor-icons/react/dist/csr/Warning';
import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/csr/DownloadSimple';

const hooks = registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context); throw error; }
} });
process.env.NEXT_PUBLIC_API_URL = 'https://api.mappr.test';
const api = await import('./api.ts');
const { ARTIFACT_ROUTES, assertTrackedArtifact, ArtifactMutationError, exportExpectation, safeArtifactFilename, artifactErrorProvenance } = await import('./artifact-safety.ts');
const { createTrackedArtifactCache } = await import('./tracked-artifact-cache.ts');
const { checkedArtifactDownload, checkedArtifactCopy } = await import('./artifact-output.ts');
const { artifactDocument, generateArtifactDocument } = await import('./artifact-document.ts');
const { OverviewChangeController } = await import('./overview-change.ts');
const { generateMarkdown } = await import('./markdown-export.ts');
const { buildOpenApiDocument } = await import('./openapi-export.ts');
const { environmentInspectionView } = await import('./env-vars-reference.ts');
const realFetch = globalThis.fetch;
after(() => { globalThis.fetch = realFetch; hooks.deregister(); });

const mapId = 'cf872244-8b9a-4fb0-88ac-91ba3df52ca2';
const generationId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const newerGeneration = '00000000-0000-4000-8000-000000000001'; // Opaque, not lexically newer.
const payloads = {
  api_contract: { version: 7, endpoints: [] }, relational_schema: { version: 7, tables: [] }, document_schema: { version: 7, collections: [] },
  readme: { version: 7, overview: 'Stored overview.', gettingStarted: [{ description: 'Install dependencies.', command: 'npm install' }] },
  adrs: { techArchHash: 'stored-key-not-currentness-proof', adrs: [] }, env_vars: { techArchHash: 'stored-key', vars: [] },
  deployment: { techArchHash: 'stored-key', components: [], environments: [], cicdSteps: [], migrations: null },
  critique: { findings: [] }, requirements: { findings: [] }, traceability: { links: [] },
};
function current(kind, extra = {}) {
  return { ...payloads[kind], mapId, sourceRevision: 7, currentRevision: 8, generationId,
    sourceFingerprint: 'verified-inputs', generatorVersion: 's5-test-v1', publishedAt: '2026-11-10T09:00:00Z',
    freshness: { status: 'fresh', reason: 'inputs_unchanged' }, isCurrent: true, inspectionOnly: false, readMode: 'tracked', ...extra };
}
function saved(kind, extra = {}) {
  return current(kind, { sourceRevision: null, generationId: null, sourceFingerprint: null, generatorVersion: null, publishedAt: null,
    freshness: { status: 'stale', reason: 'provenance_unknown' }, isCurrent: false, inspectionOnly: true, ...extra });
}
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Cookie' } }); }
function failure(code, status) { return json({ error: code, message: 'Actual backend explanation.', details: { inspectionUrl: 'https://untrusted.invalid/private' } }, status); }
function text(value = '-- verified output', type = 'text/plain', headers = {}) { return new Response(value, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store', Vary: 'Cookie', ...headers } }); }
function deferred() { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; }
const readers = {
  api_contract: api.getApiContract, relational_schema: api.getRelationalSchema, document_schema: api.getDocumentSchema,
  readme: api.getReadme, adrs: api.getAdrs, env_vars: api.getEnvVars, deployment: api.getDeployment,
  critique: api.getArchitectureReview, requirements: api.getRequirementsReview, traceability: api.getTraceability,
};
const generators = {
  api_contract: api.runApiContract, relational_schema: api.runRelationalSchema, document_schema: api.runDocumentSchema,
  readme: api.runReadme, adrs: api.runAdrs, env_vars: api.runEnvVars, deployment: api.runDeployment,
  critique: api.runArchitectureReview, requirements: api.runRequirementsReview, traceability: api.runTraceability,
};
let calls, handler;
beforeEach(() => {
  calls = [];
  handler = (url, init) => {
    if (url.pathname.endsWith('/edit-eligibility')) return json({ mapId, canEdit: true });
    const kind = Object.keys(ARTIFACT_ROUTES).find((key) => url.pathname === `/maps/${mapId}/${ARTIFACT_ROUTES[key]}`);
    if (kind && init.method === 'POST') return json({ deliberatelyUncheckedMutationBody: true });
    if (kind) return json(url.searchParams.has('includeStale') ? saved(kind) : current(kind));
    return text();
  };
  globalThis.fetch = async (value, init = {}) => {
    const url = new URL(value);
    assert.equal(url.origin, 'https://api.mappr.test', 'all HTTP must be mocked');
    calls.push({ url, init });
    return handler(url, init);
  };
});
function cache(revision = 8, refresh = async () => {}) {
  return createTrackedArtifactCache(mapId, {}, { revision: () => revision, refresh });
}

for (const [kind, read] of Object.entries(readers)) {
  test(`${kind}: tracked current, older source reuse, missing/stale/unavailable without legacy fallback`, async () => {
    const result = await read(mapId);
    assert.equal(result.sourceRevision, 7);
    assert.equal(result.currentRevision, 8);
    assert.equal(result.isCurrent, true);
    assert.equal(calls[0].url.search, '?freshness=tracked');
    assert.equal(calls[0].init.credentials, 'include');
    assert.equal(calls[0].init.cache, 'no-store');
    for (const [code, status] of [['artifact_stale', 409], ['not_found', 404], ['revision_not_ready', 503]]) {
      const before = calls.length;
      handler = () => failure(code, status);
      if (status === 404) assert.equal(await read(mapId), null);
      else await assert.rejects(read(mapId), (error) => error.status === status);
      assert.equal(calls.length, before + 1);
      assert.equal(calls.at(-1).url.search, '?freshness=tracked');
    }
  });
  test(`${kind}: owner inspection is explicit, isolated, and denied on lost/non-owner session`, async () => {
    await read(mapId);
    assert.ok(calls.every((call) => !call.url.searchParams.has('includeStale')));
    const inspection = await api.inspectSavedArtifact(mapId, read);
    assert.equal(inspection.inspectionOnly, true);
    assert.equal(calls.at(-1).url.search, '?freshness=tracked&includeStale=true');
    assert.throws(() => assertTrackedArtifact(inspection, mapId), /not verified current/);
    for (const status of [401, 404]) {
      const before = calls.length;
      handler = () => failure(status === 401 ? 'session_required' : 'not_found', status);
      await assert.rejects(api.inspectSavedArtifact(mapId, read));
      assert.equal(calls.length, before + 1, 'failed owner proof never requests private inspection');
    }
  });
}

test('legacy flags, unknown provenance, malformed metadata, wrong map and untracked payloads fail closed', async () => {
  for (const broken of [
    { ...current('api_contract'), readMode: 'legacy' }, { ...current('api_contract'), sourceRevision: null },
    { ...current('api_contract'), freshness: { status: 'fresh', reason: 'provenance_unknown' } },
    { ...current('api_contract'), currentRevision: 0 }, { ...current('api_contract'), sourceRevision: 99 },
    { ...current('api_contract'), mapId: 'another-map' }, { ...current('api_contract'), generationId: 'sortable-looking-but-invalid' },
    { ...current('api_contract'), isCurrent: true, inspectionOnly: true }, { ...current('api_contract'), endpoints: undefined },
    { mapId, version: 8, endpoints: [] },
  ]) {
    handler = () => json(broken);
    await assert.rejects(api.getApiContract(mapId));
  }
  assert.doesNotThrow(() => assertTrackedArtifact(saved('readme'), mapId, 'inspection'));
});

const exports = [
  ['PostgreSQL SQL', '/relational-schema/sql?dialect=postgres', (e) => api.getRelationalSchemaSql(mapId, 'postgres', e), 'application/sql'],
  ['MySQL SQL', '/relational-schema/sql?dialect=mysql', (e) => api.getRelationalSchemaSql(mapId, 'mysql', e), 'text/plain'],
  ['SQLite SQL', '/relational-schema/sql?dialect=sqlite', (e) => api.getRelationalSchemaSql(mapId, 'sqlite', e), 'text/x-sql'],
  ['mongosh script', '/document-schema/script', (e) => api.getDocumentSchemaScript(mapId, e), 'application/javascript'],
  ['ADR Markdown', '/adrs/markdown', (e) => api.getAdrsMarkdown(mapId, e), 'text/markdown'],
  ['README Markdown', '/readme/markdown', (e) => api.getReadmeMarkdown(mapId, e), 'text/markdown'],
  ['environment file', '/env-vars/file', (e) => api.getEnvVarsFile(mapId, e), 'text/plain'],
  ['deployment Markdown', '/deployment/markdown', (e) => api.getDeploymentMarkdown(mapId, e), 'text/markdown'],
];
for (const [name, route, download, type] of exports) {
  test(`${name}: guarded URL, no-store, text/content-type validation and HTTP errors never become files`, async () => {
    handler = () => text('Exact output\nincluding omission notes.\n', type);
    assert.equal(await download(), 'Exact output\nincluding omission notes.\n');
    assert.equal(calls[0].url.pathname + calls[0].url.search, `/maps/${mapId}${route}`);
    assert.equal(calls[0].init.credentials, 'include');
    assert.equal(calls[0].init.cache, 'no-store');
    for (const status of [400, 401, 404, 409, 503]) {
      handler = () => failure(status === 409 ? 'artifact_stale' : 'unavailable', status);
      await assert.rejects(download(), (error) => error.status === status);
    }
    handler = () => json({ error: 'artifact_stale' });
    await assert.rejects(download(), /content type/);
    handler = () => text('{"error":"artifact_stale"}', type);
    await assert.rejects(download(), /error document/);
    handler = () => text('<!doctype html><html>Error</html>', type);
    await assert.rejects(download(), /HTML document/);
    assert.ok(calls.every((call) => !call.url.searchParams.has('includeStale')));
  });
}

test('export headers are snapshot checks, never leases; changed same-revision generations are not cached', async () => {
  const expected = exportExpectation(current('readme'));
  handler = () => text('# Current', 'text/markdown', { 'X-Mappr-Current-Revision': '7', 'X-Mappr-Artifact-Generation': generationId });
  await assert.rejects(api.getReadmeMarkdown(mapId, expected), /snapshot changed/);
  handler = () => text('# Republished', 'text/markdown', { 'X-Mappr-Current-Revision': '8', 'X-Mappr-Artifact-Generation': newerGeneration });
  await assert.rejects(api.getReadmeMarkdown(mapId, expected), /snapshot changed/);
  handler = () => text('# Valid', 'text/markdown', { 'X-Mappr-Current-Revision': '8', 'X-Mappr-Artifact-Generation': generationId, 'X-Mappr-Render-Fingerprint': 'render-one' });
  assert.equal(await api.getReadmeMarkdown(mapId, expected), '# Valid');
  handler = () => text('# Updated optional-support omission note', 'text/markdown', { 'X-Mappr-Current-Revision': '8', 'X-Mappr-Artifact-Generation': generationId, 'X-Mappr-Render-Fingerprint': 'render-two' });
  assert.equal(await api.getReadmeMarkdown(mapId, expected), '# Updated optional-support omission note');
  const before = calls.length;
  assert.throws(() => api.getRelationalSchemaSql(mapId, 'postgres&includeStale=true'));
  assert.equal(calls.length, before);
});

test('all ten mutations ignore raw POST output and install only a subsequent tracked read', async () => {
  for (const [kind, generate] of Object.entries(generators)) {
    calls = [];
    const result = await generate(mapId);
    assert.equal(result.readMode, 'tracked');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[1].url.search, '?freshness=tracked');
    assert.equal(calls[0].url.pathname, `/maps/${mapId}/${ARTIFACT_ROUTES[kind]}`);
  }
});

test('finding PATCH preserves its body and rechecks tracked output before current installation', async () => {
  for (const [kind, mutate] of [['critique', api.setFindingDismissed], ['requirements', api.setRequirementDismissed]]) {
    handler = (url, init) => init.method === 'PATCH' ? json({ unchecked: true }) : json(current(kind));
    const result = await mutate(mapId, 'finding-id', true);
    assert.equal(result.readMode, 'tracked');
    assert.deepEqual(JSON.parse(calls.at(-2).init.body), { dismissed: true });
    assert.equal(calls.at(-2).init.method, 'PATCH');
    assert.equal(calls.at(-1).url.search, '?freshness=tracked');
  }
});

test('publication conflict/lost response refetch without repeating AI and retain actual errors', async () => {
  for (const code of ['artifact_source_changed', 'artifact_publication_conflict', 'lost_response']) {
    calls = [];
    handler = (url, init) => {
      if (init.method === 'POST') {
        if (code === 'lost_response') throw new TypeError('Disconnected after publication');
        return failure(code, 409);
      }
      return json(current('api_contract', { generationId: newerGeneration }));
    };
    await assert.rejects(api.runApiContract(mapId), (error) => error instanceof ArtifactMutationError && error.currentRecord.generationId === newerGeneration);
    assert.equal(calls.filter((call) => call.init.method === 'POST').length, 1);
    assert.equal(calls.filter((call) => call.url.search === '?freshness=tracked').length, 1);
  }
});

test('current and saved inspection caches are distinct and retired session/map responses cannot publish', async () => {
  const ownerCache = cache(), entry = ownerCache.getTracked('api_contract'), inspection = ownerCache.getTracked('api_contract', true);
  await entry.ensureLoaded(() => api.getApiContract(mapId));
  await inspection.ensureLoaded(() => api.inspectSavedArtifact(mapId, api.getApiContract));
  assert.equal(entry.getSnapshot().status, 'current');
  assert.equal(inspection.getSnapshot().status, 'inspection');
  let downloads = 0;
  await inspection.download(async () => { downloads++; return true; });
  assert.equal(downloads, 0);
  const wait = deferred();
  inspection.invalidate();
  const pending = inspection.ensureLoaded(() => wait.promise);
  ownerCache.retire();
  const nextSession = cache(), nextMap = createTrackedArtifactCache('other-map', {}, { revision: () => 8, refresh: async () => {} });
  wait.resolve(saved('api_contract'));
  await pending;
  assert.equal(inspection.getSnapshot().record, null);
  assert.equal(nextSession.getTracked('api_contract', true).getSnapshot().record, null);
  assert.equal(nextMap.getTracked('api_contract', true).getSnapshot().record, null);
});

test('superseded same-revision requests use epochs rather than UUID sorting', async () => {
  const c = cache(), entry = c.getTracked('api_contract'), first = deferred();
  const pending = entry.ensureLoaded(() => first.promise);
  entry.invalidate();
  await entry.ensureLoaded(async () => current('api_contract', { generationId: newerGeneration }));
  first.resolve(current('api_contract', { generationId }));
  await pending;
  assert.equal(entry.getSnapshot().record.generationId, newerGeneration);
  assert.equal(entry.getSnapshot().status, 'current');
});

test('canonical high-water rejects lower currentRevision while accepting an older source revision', async () => {
  let refreshes = 0;
  const c = cache(8, async () => { refreshes++; }), entry = c.getTracked('api_contract');
  await entry.ensureLoaded(async () => current('api_contract'));
  const accepted = entry.getSnapshot().record;
  await entry.reload(async () => current('api_contract', { currentRevision: 7 }));
  assert.equal(refreshes, 1);
  assert.equal(entry.getSnapshot().record, accepted);
  assert.equal(entry.getSnapshot().status, 'unavailable');
  let revision = 8;
  const advancing = createTrackedArtifactCache(mapId, {}, { revision: () => revision, refresh: async () => { revision = 9; } });
  await advancing.getTracked('api_contract').ensureLoaded(async () => current('api_contract', { currentRevision: 9 }));
  assert.equal(advancing.getTracked('api_contract').getSnapshot().record, null, 'new metadata cannot be combined with an old view scope');
  const replacement = createTrackedArtifactCache(mapId, {}, { revision: () => revision, refresh: async () => {} });
  await replacement.getTracked('api_contract').ensureLoaded(async () => current('api_contract', { currentRevision: 9 }));
  assert.equal(replacement.getTracked('api_contract').getSnapshot().record.currentRevision, 9);
});

test('dependent README/deployment state invalidates before and after same-revision publication', async () => {
  for (const kind of ['api_contract', 'relational_schema', 'document_schema', 'adrs', 'env_vars']) {
    const c = cache(), dependent = kind === 'env_vars' ? 'deployment' : 'readme';
    const document = c.getTracked(dependent), publisher = c.getTracked(kind), wait = deferred();
    await document.ensureLoaded(async () => current(dependent));
    await publisher.ensureLoaded(async () => current(kind));
    const publishing = publisher.generate(() => wait.promise);
    assert.equal(document.getSnapshot().record, null);
    await document.ensureLoaded(async () => current(dependent));
    wait.resolve(current(kind, { generationId: newerGeneration }));
    await publishing;
    assert.equal(document.getSnapshot().record, null, 'reads before publication cannot retain old rendered support');
    assert.equal(publisher.getSnapshot().record.generationId, newerGeneration);
  }
});

test('lost publication installs only recovered verified tracked state, not unchecked mutation data', async () => {
  const c = cache(), entry = c.getTracked('api_contract');
  await entry.ensureLoaded(async () => current('api_contract'));
  await entry.generate(async () => { throw new ArtifactMutationError(new Error('Lost response'), current('api_contract', { generationId: newerGeneration })); });
  assert.equal(entry.getSnapshot().record.generationId, newerGeneration);
  assert.equal(entry.getSnapshot().status, 'current');
  assert.ok(entry.getSnapshot().failure);
  await entry.generate(async () => { throw new ArtifactMutationError(new Error('Lost response'), { mapId, endpoints: [] }); });
  assert.equal(entry.getSnapshot().status, 'unavailable');
});

test('frontend OpenAPI export uses the freshly verified exact contract; stale/unknown output is blocked', async () => {
  for (const allowed of [false, true]) {
    const files = [];
    const operation = () => checkedArtifactDownload({ current: allowed, read: async () => current('api_contract'), valid: () => true,
      render: async (fresh) => ({ filename: 'mappr-openapi-v7.json', content: JSON.stringify(buildOpenApiDocument(fresh, 'Canonical name')), mimeType: 'application/json' }),
      deliver: (file) => files.push(file) });
    if (allowed) { await operation(); assert.equal(JSON.parse(files[0].content).info.title, 'Canonical name'); }
    else { await assert.rejects(operation(), /disabled/); assert.equal(files.length, 0); }
  }
});

test('changed output, retired scopes and stale copy never produce a client file or clipboard action', async () => {
  const files = [], first = current('api_contract');
  let reads = 0;
  await assert.rejects(checkedArtifactDownload({ current: true, valid: () => true,
    read: async () => reads++ === 0 ? first : current('api_contract', { generationId: newerGeneration }),
    render: async () => ({ filename: 'safe.json', content: '{}', mimeType: 'application/json' }), deliver: (file) => files.push(file) }), /changed during download/);
  assert.equal(await checkedArtifactDownload({ current: true, valid: () => false, read: async () => first,
    render: async () => { throw Error('Must not render'); }, deliver: (file) => files.push(file) }), false);
  assert.equal(files.length, 0);
  await assert.rejects(checkedArtifactCopy(false, saved('env_vars'), async () => first, () => true), /disabled/);
  await assert.rejects(checkedArtifactCopy(true, first, async () => current('api_contract', { generationId: newerGeneration }), () => true), /changed/);
  await assert.rejects(checkedArtifactCopy(true, first, async () => first, () => false), /changed/);
  await checkedArtifactCopy(true, first, async () => first, () => true);
  for (const filename of ['../unsafe.sql', 'dir/file.md', 'dir\\file.md', 'bad\nname.env']) assert.throws(() => safeArtifactFilename(filename));
  assert.equal(safeArtifactFilename('.env.example'), '.env.example');
});

test('canonical revision advancement immediately before delivery blocks file/copy despite a still-mounted cache', async () => {
  let revision = 8;
  const c = createTrackedArtifactCache(mapId, {}, { revision: () => revision, refresh: async () => {} });
  const record = current('api_contract'), files = [];
  const delivered = await checkedArtifactDownload({ current: true, read: async () => record,
    render: async () => { revision = 9; return { filename: 'old.json', content: '{}', mimeType: 'application/json' }; },
    valid: (latest) => c.isCurrentRecord(latest), deliver: (file) => files.push(file) });
  assert.equal(delivered, false);
  assert.equal(files.length, 0);
  await assert.rejects(checkedArtifactCopy(true, record, async () => record, (latest) => c.isCurrentRecord(latest)), /changed/);
});

test('stale error provenance is displayed without treating error metadata as an artifact or following its URL', () => {
  const error = new api.ApiError(409, { error: 'artifact_stale', details: {
    sourceRevision: 7, currentRevision: 8, freshness: { status: 'stale', reason: 'payload_changed' }, inspectionUrl: 'https://untrusted.invalid',
  } });
  assert.deepEqual(artifactErrorProvenance(error), { sourceRevision: 7, reason: 'payload_changed' });
  assert.deepEqual(artifactErrorProvenance(new api.ApiError(503, { error: 'unavailable', details: { sourceRevision: -1, reason: 'made-up' } })), {});
});

test('README/deployment inspection never invokes current rendering; omission notes remain exact', async () => {
  for (const kind of ['readme', 'deployment']) {
    let renders = 0;
    const inspection = await artifactDocument(saved(kind), async () => { throw Error('Must not read/join current'); }, async () => { renders++; return '# Wrong'; });
    assert.equal(inspection.markdown, null);
    assert.equal(renders, 0);
    const omitted = '# Instructions\n\nNote: optional stale supporting output was omitted.\n';
    const document = await artifactDocument(current(kind), async () => current(kind), async () => omitted);
    assert.equal(document.markdown, omitted);
    await assert.rejects(artifactDocument(current(kind), async () => current(kind, { generationId: newerGeneration }), async () => omitted), /changed/);
    await assert.rejects(generateArtifactDocument(async () => { throw new ArtifactMutationError(new Error('Lost'), current(kind)); }, async () => current(kind), async () => omitted),
      (error) => error.currentRecord.record.mapId === mapId && error.currentRecord.markdown === omitted);
  }
});

test('old S4/legacy snapshots cannot lower the canonical authority used for artifact validation', async () => {
  const base = { meta: { productName: 'Sample', oneLineSummary: 'Header' }, product: { summary: 'Summary', concepts: [] }, users: [], features: [], techStack: [],
    architecture: { nodes: [], edges: [] }, dataModel: { entities: [], relations: [] }, designSystem: { colors: [], typography: [], spacing: [], components: [] }, developmentPlan: [] };
  const controller = new OverviewChangeController(mapId, base, 9);
  const c = createTrackedArtifactCache(mapId, base, { revision: controller.getRevision, refresh: async () => {} });
  await c.getTracked('api_contract').ensureLoaded(async () => current('api_contract', { currentRevision: 9 }));
  controller.acceptIteration({ ...base, product: { ...base.product, summary: 'Old' } }, 8, mapId);
  assert.equal(controller.getRevision(), 9);
  await c.getTracked('api_contract').reload(async () => current('api_contract', { currentRevision: 8 }));
  assert.equal(c.getTracked('api_contract').getSnapshot().record.currentRevision, 9);
});

const components = new Map();
function component(file) {
  if (components.has(file)) return components.get(file);
  const url = new URL('../components/' + file + '.tsx', import.meta.url), require = createRequire(url), result = {};
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const icons = { CheckIcon, WarningIcon, CircleNotchIcon, ArrowsClockwiseIcon, DownloadSimpleIcon };
  runInNewContext(code, { exports: result, require: (name) => name.endsWith('.module.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    : name === '@phosphor-icons/react' ? icons : ['./ArtifactSafety', './ActionButton'].includes(name) ? component(name.slice(2)) : require(name) });
  components.set(file, result);
  return result;
}
test('accessible safety status blocks stale export and explains owner inspection; verified controls remain usable', () => {
  const { ArtifactSafety, SavedArtifactFields } = component('ArtifactSafety'), { ArtifactActionButton } = component('ArtifactActions');
  for (const verified of [false, true]) {
    const safety = { status: verified ? 'current' : 'inspection', inspection: !verified, canExport: verified, busy: false, sourceRevision: verified ? 7 : null,
      reason: verified ? 'inputs_unchanged' : 'provenance_unknown', current() {}, inspect() {}, verifyCopy: async () => {} };
    const html = renderToStaticMarkup(React.createElement(ArtifactSafety, { safety },
      React.createElement(SavedArtifactFields, { value: saved('readme') }),
      React.createElement(ArtifactActionButton, { action: 'export', idleLabel: 'Markdown export', pendingLabel: 'Preparing download' })));
    assert.match(html, verified ? /Verified current/ : /inspection only/);
    assert.match(html, /role="status"/);
    assert.equal(/disabled=""/.test(html), !verified);
    if (!verified) { assert.match(html, /aria-describedby=/); assert.match(html, /Source revision unverified/); assert.match(html, /read only/); }
    assert.ok(!html.includes('verified-inputs'), 'no source fingerprints in normal status prose');
  }
});

test('actual output inventory keeps canonical JSON/Markdown/PDF separate and closes cached generated alternatives', () => {
  const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.match(read('../components/ApiContractView.tsx'), /buildOpenApiDocument\(fresh, productName\)/);
  for (const file of ['ReadmeView', 'DeploymentView']) {
    const source = read('../components/' + file + '.tsx');
    assert.match(source, /content: await get(?:Readme|Deployment)Markdown/);
    assert.ok(!source.includes('content: preview.markdown'));
    assert.match(source, /SavedArtifactFields/);
  }
  for (const file of ['ReadmeMarkdown', 'DeploymentMarkdown', 'EnvVarsView']) assert.match(read('../components/' + file + '.tsx'), /await safety.verifyCopy\(\)/);
  const canonical = { meta: { productName: 'Canonical', oneLineSummary: 'Header' }, product: { summary: 'Canonical summary', concepts: [] }, users: [], features: [], techStack: [],
    architecture: { nodes: [], edges: [] }, dataModel: { entities: [], relations: [] }, designSystem: { colors: [], typography: [], spacing: [], components: [] }, developmentPlan: [] };
  assert.match(generateMarkdown(canonical), /Canonical summary/);
  assert.match(read('../components/ExportMenu.tsx'), /data: MapprSystem/);
  assert.match(read('../components/MapPdfDocument.tsx'), /data: MapprSystem/);
  assert.ok(!/getApiContract|getReadme|getAdrs/.test(read('../components/ExportMenu.tsx')));
});

test('network-backed export actions use the shared spinner-only pending state with an accurate accessible label', () => {
  const { ArtifactSafety } = component('ArtifactSafety'), { ArtifactActionButton } = component('ArtifactActions');
  const safety = { status: 'current', inspection: false, canExport: false, busy: true, sourceRevision: 7, reason: null,
    current() {}, inspect() {}, verifyCopy: async () => {} };
  const html = renderToStaticMarkup(React.createElement(ArtifactSafety, { safety }, React.createElement(ArtifactActionButton, {
    action: 'export', state: 'pending', idleLabel: 'Markdown export', pendingLabel: 'Preparing verified Markdown',
  })));
  assert.match(html, /aria-label="Preparing verified Markdown"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /data-state="pending"/);
  assert.match(html, /spinner/);
  for (const file of ['ApiContractView', 'ReadmeView', 'DeploymentView']) {
    assert.match(readFileSync(new URL('../components/' + file + '.tsx', import.meta.url), 'utf8'), /state=\{isDownloading \? 'pending'/);
  }
});

test('saved environment inspection preserves the existing sensitive-example masking without changing saved values', () => {
  const secret = { name: 'API_KEY', secret: true, placeholder: 'actual-private-value', description: 'Existing description', nodeId: 'api', techStackCategory: null, required: true };
  const placeholder = { ...secret, placeholder: 'YOUR_API_KEY' };
  const record = saved('env_vars', { vars: [secret, placeholder] });
  const display = environmentInspectionView(record);
  assert.equal(display.vars[0].placeholder, 'Sensitive-looking example withheld');
  assert.equal(display.vars[1].placeholder, 'YOUR_API_KEY');
  assert.equal(display.vars[0].description, secret.description);
  assert.equal(display.vars[0].nodeId, secret.nodeId);
  assert.equal(record.vars[0].placeholder, 'actual-private-value');
  assert.equal(display.inspectionOnly, true);
  const source = readFileSync(new URL('../components/EnvVarsView.tsx', import.meta.url), 'utf8');
  assert.match(source, /SavedArtifactFields value=\{environmentInspectionView\(record\)\}/);
});
