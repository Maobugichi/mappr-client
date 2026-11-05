import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ancestorPaths, buildJsonIndex, childPath, effectiveOpenPaths, findEntries,
  initialInspectorState, jsonValueText, pathsToDepth, propertyPath,
  reconcileInspectorState, visiblePaths,
} from './json-inspector.ts';

const data = {
  features: [{ name: 'Login', enabled: true }, { name: 'Client Directory', limit: 25, note: null }],
  metadata: { 'a.b': { 'quote"and/slash~': 'Line one\n  Line two' } },
  empty: [],
};

test('indexes the full hierarchy in document order without altering source data', () => {
  const before = JSON.stringify(data);
  const index = buildJsonIndex(data);
  assert.equal(index.get('').value, data);
  assert.equal(index.get('/features/1/name').value, 'Client Directory');
  assert.equal(index.get('/features/1').parent, '/features');
  assert.equal(index.get('/features/1/name').displayPath, '$.features[1].name');
  assert.deepEqual(index.get('/features').children, ['/features/0', '/features/1']);
  assert.equal(JSON.stringify(data), before);
});

test('paths quote escaped, empty, numeric, unicode and punctuation keys unambiguously', () => {
  for (const key of ['a.b', 'a b', '', '0', 'quote"', 'slash/', 'line\nbreak', '\ud800', '日本語']) {
    assert.equal(propertyPath('$', key, false), '$[' + JSON.stringify(key) + ']');
  }
  assert.equal(propertyPath('$', '$normal_1', false), '$.$normal_1');
  assert.equal(propertyPath('$.features', '2', true), '$.features[2]');
  const index = buildJsonIndex({ 'a/b': 1, a: { b: 2 }, 'a~1b': 3, '\ud800': 4 });
  assert.equal(index.get('/a~1b').value, 1);
  assert.equal(index.get('/a/b').value, 2);
  assert.equal(index.get('/a~01b').value, 3);
  assert.equal(index.get(childPath('', '\ud800')).value, 4);
});

test('Find includes hidden keys, strings, numbers, booleans, null and primitive array elements', () => {
  const index = buildJsonIndex(data);
  assert.equal(visiblePaths(index, new Set([''])).has('/features/1/name'), false);
  for (const [query, expected] of [['CLIENT DIRECTORY', '/features/1/name'], ['enabled', '/features/0/enabled'],
    ['TRUE', '/features/0/enabled'], ['25', '/features/1/limit'], ['null', '/features/1/note'], ['a.b', '/metadata/a.b']]) {
    assert.ok(findEntries(index, query).some((entry) => entry.path === expected), query);
  }
  const primitives = buildJsonIndex(['needle', false, 37, null]);
  assert.equal(findEntries(primitives, 'NEEDLE')[0].displayPath, '$[0]');
  assert.equal(findEntries(primitives, 'false')[0].displayPath, '$[1]');
  assert.equal(findEntries(primitives, '37')[0].displayPath, '$[2]');
  assert.equal(findEntries(primitives, 'null')[0].displayPath, '$[3]');
  assert.equal(findEntries(buildJsonIndex('Root needle'), 'needle')[0].displayPath, '$');
});

test('match counts represent actual entries and handle blank and absent queries', () => {
  const index = buildJsonIndex({ match: 'MATCH', nested: { match: false } });
  assert.equal(findEntries(index, 'match').length, 2);
  assert.deepEqual(findEntries(index, 'missing'), []);
  assert.deepEqual(findEntries(index, '  '), []);
});

test('search reveals only required ancestors and clearing preserves manual branches', () => {
  const index = buildJsonIndex(data), manual = new Set(['', '/metadata']);
  const before = new Set(manual);
  const revealed = ancestorPaths(index, '/features/1/name');
  assert.deepEqual(revealed, new Set(['/features/1', '/features', '']));
  const effective = effectiveOpenPaths(manual, revealed, new Set());
  assert.equal(visiblePaths(index, effective).has('/features/1/name'), true);
  assert.equal(effective.has('/features/0'), false);
  assert.equal(effective.has('/metadata'), true);
  assert.deepEqual(effectiveOpenPaths(manual, new Set(), new Set()), before);
  assert.deepEqual(manual, before);
});

test('manual collapse can hide a match without invalidating the selection or path', () => {
  const index = buildJsonIndex(data), selected = index.get('/features/1/name');
  const opened = effectiveOpenPaths(new Set(['']), ancestorPaths(index, selected.path), new Set(['/features']));
  assert.equal(visiblePaths(index, opened).has(selected.path), false);
  assert.equal(selected.displayPath, '$.features[1].name');
  assert.equal(jsonValueText(selected.value), '"Client Directory"');
});

test('depth presets retain root-zero semantics and ignore empty containers', () => {
  const index = buildJsonIndex(data);
  assert.deepEqual(pathsToDepth(index, 1), new Set(['']));
  assert.deepEqual(pathsToDepth(index, 2), new Set(['', '/features', '/metadata']));
  const level3 = pathsToDepth(index, 3);
  assert.equal(level3.has('/features/0'), true);
  assert.equal(level3.has('/metadata/a.b'), true);
  assert.equal(level3.has('/empty'), false);
  assert.equal(pathsToDepth(index, Infinity).size, 6);
});

test('copied JSON values are complete and preserve strings, escapes, line breaks and indentation', () => {
  const values = [data, data.features, null, true, 25, 'x'.repeat(500) + '\n  "quoted"\\end'];
  for (const value of values) {
    const text = jsonValueText(value);
    assert.equal(text, JSON.stringify(value, null, 2));
    assert.deepEqual(JSON.parse(text), value);
  }
  assert.throws(() => jsonValueText(undefined), /not representable/);
});

test('changed data validates preserved selection and expansion without using old values', () => {
  const state = { ...initialInspectorState(data), mode: 'pretty', query: 'client',
    manualPaths: new Set(['', '/features', '/metadata']), selectedPath: '/features/1/name',
    matchPath: '/features/1/name', searchClosed: new Set(['/metadata']) };
  const replacement = { features: [{ name: 'Replacement' }] }, index = buildJsonIndex(replacement);
  const next = reconcileInspectorState(state, replacement, index);
  assert.equal(next.source, replacement);
  assert.equal(next.mode, 'pretty');
  assert.equal(next.query, 'client');
  assert.equal(next.selectedPath, '');
  assert.equal(next.matchPath, null);
  assert.equal(next.manualPaths.has('/metadata'), false);
  assert.equal(next.searchClosed.has('/metadata'), false);
  assert.equal(index.get('/features/0/name').value, 'Replacement');
});

test('handles large documents and deeply nested search without a visible-node-only scan', () => {
  const large = { rows: Array.from({ length: 10000 }, (_, i) => ({ id: i, description: 'needle-' + i, enabled: true })) };
  const index = buildJsonIndex(large);
  assert.equal(index.size, 40002);
  assert.equal(findEntries(index, 'needle-9999')[0].displayPath, '$.rows[9999].description');
  assert.equal(findEntries(index, 'enabled').length, 10000);
  const deep = {}; let cursor = deep;
  for (let i = 0; i < 600; i++) { cursor.child = {}; cursor = cursor.child; }
  cursor.value = 'deep needle';
  const deepIndex = buildJsonIndex(deep);
  const [match] = findEntries(deepIndex, 'deep needle');
  assert.equal(ancestorPaths(deepIndex, match.path).size, 601);
});
