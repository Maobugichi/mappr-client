import assert from 'node:assert/strict';
import test from 'node:test';
import { GeneratedArtifactCache } from './generated-artifact-cache.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('first visit and rapid remounts share one saved-artifact request', async () => {
  const response = deferred();
  let requests = 0;
  const load = () => { requests++; return response.promise; };
  const cache = new GeneratedArtifactCache('project-a');
  const first = cache.get(load);
  assert.equal(first.getSnapshot().isLoading, true);
  const request = first.ensureLoaded(load);
  const remounted = cache.get(load);
  assert.equal(remounted.ensureLoaded(load), request);
  await Promise.resolve();
  assert.equal(requests, 1);
  const schema = { version: 1, tables: [{ entityId: 'clients', tableName: 'clients' }] };
  response.resolve(schema);
  await request;
  assert.equal(remounted.getSnapshot().record, schema);
  assert.equal(remounted.getSnapshot().isLoading, false);
  await remounted.ensureLoaded(load);
  assert.equal(requests, 1);
});

test('an existing empty result is cached without silently generating or reloading', async () => {
  let requests = 0;
  const load = async () => { requests++; return null; };
  const cache = new GeneratedArtifactCache('project-a');
  await cache.get(load).ensureLoaded(load);
  await cache.get(load).ensureLoaded(load);
  assert.equal(requests, 1);
  assert.equal(cache.get(load).getSnapshot().loaded, true);
  assert.equal(cache.get(load).getSnapshot().record, null);
});

test('regeneration retains the displayed result, deduplicates actions and commits while unmounted', async () => {
  const original = { version: 1 }, updated = { version: 2 };
  const load = async () => original;
  const cache = new GeneratedArtifactCache('project-a');
  const entry = cache.get(load);
  await entry.ensureLoaded(load);
  let notices = 0, generations = 0;
  const unsubscribe = entry.subscribe(() => notices++);
  const response = deferred();
  const generate = () => { generations++; return response.promise; };
  const pending = entry.generate(generate);
  assert.equal(entry.getSnapshot().record, original);
  assert.equal(entry.getSnapshot().operation, 'generate');
  assert.equal(entry.getSnapshot().isLoading, false);
  await entry.generate(generate);
  unsubscribe();
  const before = notices;
  response.resolve(updated);
  await pending;
  assert.equal(notices, before);
  assert.equal(generations, 1);
  const reopened = cache.get(load).getSnapshot();
  assert.equal(reopened.record, updated);
  assert.equal(reopened.resultRevision, 1);
  assert.equal(reopened.operation, null);
});

test('regeneration failure preserves working content and permits a successful retry', async () => {
  const original = { version: 1 };
  const load = async () => original;
  const entry = new GeneratedArtifactCache('project-a').get(load);
  await entry.ensureLoaded(load);
  const error = new Error('Actual generator failure');
  await entry.generate(async () => { throw error; });
  assert.equal(entry.getSnapshot().record, original);
  assert.equal(entry.getSnapshot().failure.cause, error);
  assert.equal(entry.getSnapshot().operation, null);
  await entry.ensureLoaded(() => { throw new Error('Must not refetch working content'); });
  const replacement = { version: 2 };
  await entry.generate(async () => replacement);
  assert.equal(entry.getSnapshot().record, replacement);
  assert.equal(entry.getSnapshot().failure, null);
});

test('failed initial loads can retry; failed reloads retain the previous artifact', async () => {
  const load = async () => ({ version: 1 });
  const entry = new GeneratedArtifactCache('project-a').get(load);
  await entry.ensureLoaded(async () => { throw new Error('Offline'); });
  assert.equal(entry.getSnapshot().loaded, false);
  assert.equal(entry.getSnapshot().isLoading, false);
  await entry.ensureLoaded(load);
  const original = entry.getSnapshot().record;
  await entry.reload(async () => { throw new Error('Unavailable'); });
  assert.equal(entry.getSnapshot().record, original);
  assert.equal(entry.getSnapshot().failure.kind, 'reload');
  assert.equal(entry.getSnapshot().operation, null);
});

test('project, artifact kind and changed source scopes never share results or selection state', async () => {
  const loadSql = async () => ({ tables: ['clients'] });
  const loadDocuments = async () => ({ collections: ['events'] });
  const projectA = new GeneratedArtifactCache('a', { revision: 1 });
  const projectB = new GeneratedArtifactCache('b', { revision: 1 });
  const revisedA = new GeneratedArtifactCache('a', { revision: 2 });
  await projectA.get(loadSql).ensureLoaded(loadSql);
  projectA.viewState.set('schema:selection:relational', 'clients');
  for (const isolated of [projectB, revisedA]) {
    assert.equal(isolated.get(loadSql).getSnapshot().record, null);
    assert.equal(isolated.get(loadSql).getSnapshot().isLoading, true);
    assert.equal(isolated.viewState.has('schema:selection:relational'), false);
  }
  assert.equal(projectA.get(loadDocuments).getSnapshot().record, null);
  assert.equal(projectA.viewState.get('schema:selection:relational'), 'clients');
});

test('late responses from an obsolete source cannot overwrite its replacement cache', async () => {
  const response = deferred();
  const load = () => response.promise;
  const old = new GeneratedArtifactCache('a', {});
  const current = new GeneratedArtifactCache('a', {});
  const pending = old.get(load).ensureLoaded(load);
  const currentRecord = { version: 2 };
  await current.get(load).ensureLoaded(async () => currentRecord);
  response.resolve({ version: 1 });
  await pending;
  assert.equal(current.get(load).getSnapshot().record, currentRecord);
});

test('export and generation share a lock; failed exports preserve the artifact', async () => {
  const load = async () => ({ version: 1 });
  const entry = new GeneratedArtifactCache('a').get(load);
  await entry.ensureLoaded(load);
  const response = deferred();
  let exports = 0, generations = 0;
  const pending = entry.download(() => { exports++; return response.promise; });
  await entry.download(async () => { exports++; return true; });
  await entry.generate(async () => { generations++; return { version: 2 }; });
  response.resolve(true);
  await pending;
  assert.equal(exports, 1);
  assert.equal(generations, 0);
  assert.equal(entry.getSnapshot().downloaded, true);
  await entry.download(async () => { throw new Error('Export failed'); });
  assert.deepEqual(entry.getSnapshot().record, { version: 1 });
  assert.equal(entry.getSnapshot().failure.kind, 'download');
  assert.equal(entry.getSnapshot().operation, null);
});
