import assert from 'node:assert/strict';
import test from 'node:test';
import { getArchitectureLayout, getArchitectureEdgePath, getArchitectureViewport, getArchitectureInitialViewport, ARCHITECTURE_INITIAL_MAX_ZOOM, getArchitectureLabelSize } from './architecture-layout.ts';

const connections = [
  ['web', 'api', 'calls'], ['web', 'infra', 'deployed on'],
  ['api', 'cache', 'reads/writes cache'], ['api', 'db', 'reads/writes persistent data'],
  ['api', 'infra', 'deployed on'], ['cache', 'db', 'fallback on miss'],
  ['cache', 'infra', 'deployed on'], ['db', 'infra', 'deployed on'],
];
function fixture(connectionsOverride = connections) {
  const nodes = ['web', 'api', 'cache', 'db', 'infra'].map((id) => ({
    id, data: { label: id }, position: { x: 0, y: 0 },
  }));
  const edges = connectionsOverride.map(([source, target, label], index) => ({
    id: String(index), source, target, label,
  }));
  return getArchitectureLayout(nodes, edges);
}
function inside(point, box, padding = 0) {
  return point.x > box.x - padding && point.x < box.x + box.width + padding &&
    point.y > box.y - padding && point.y < box.y + box.height + padding;
}
function nodeBox(node) { return { ...node.position, ...node.style }; }
function labelBox(edge) {
  const { label, labelWidth, labelHeight } = edge.data.route;
  return { x: label.x - labelWidth / 2, y: label.y - labelHeight / 2, width: labelWidth, height: labelHeight };
}
function overlaps(a, b, gap = 0) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}
function samples(points) {
  const result = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const count = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let j = 0; j <= count; j++) {
      result.push({ x: a.x + (b.x - a.x) * j / count, y: a.y + (b.y - a.y) * j / count });
    }
  }
  return result;
}

test('long deployment routes do not cross or share lanes with other connections', () => {
  const { edges } = fixture();
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i].data.route.points, b = edges[j].data.route.points;
    for (let k = 1; k < a.length; k++) for (let l = 1; l < b.length; l++) {
      const intersects = cross(a[k - 1], a[k], b[l - 1]) * cross(a[k - 1], a[k], b[l]) < 0 &&
        cross(b[l - 1], b[l], a[k - 1]) * cross(b[l - 1], b[l], a[k]) < 0;
      assert.ok(!intersects, `connections ${edges[i].id}/${edges[j].id} cross`);
      if (a[k - 1].x === a[k].x && b[l - 1].x === b[l].x && a[k].x === b[l].x) {
        const sharedLength = Math.min(Math.max(a[k - 1].y, a[k].y), Math.max(b[l - 1].y, b[l].y)) -
          Math.max(Math.min(a[k - 1].y, a[k].y), Math.min(b[l - 1].y, b[l].y));
        assert.ok(sharedLength <= 0, 'connections share a vertical lane');
      }
    }
  }
});

test('the complete Express / Redis graph reserves space for nodes, lanes and tags', () => {
  const { nodes, edges } = fixture();
  for (const edge of edges) {
    const label = labelBox(edge);
    for (const node of nodes) assert.ok(!overlaps(label, nodeBox(node), 24), `tag ${edge.id} near node ${node.id}`);
    for (const other of edges) {
      if (other.id === edge.id) continue;
      assert.ok(!overlaps(label, labelBox(other), 24), `tags ${edge.id}/${other.id}`);
      assert.ok(samples(other.data.route.points).every((p) => !inside(p, label, 12)), `line ${other.id} crosses tag ${edge.id}`);
    }
    for (const node of nodes) {
      if (node.id === edge.source || node.id === edge.target) continue;
      assert.ok(samples(edge.data.route.points).every((p) => !inside(p, nodeBox(node), 32)), `line ${edge.id} near node ${node.id}`);
    }
    const route = edge.data.route;
    assert.ok(route.points.some((p) => p.x === route.label.x && p.y === route.label.y), `tag ${edge.id} detached`);
    assert.ok(!getArchitectureEdgePath(route.points, route.label).includes('NaN'));
  }
});

test('connections use distinct ports and preserve parallel relationships', () => {
  const { nodes, edges } = fixture([...connections, ['api', 'db', 'replication']]);
  assert.equal(edges.length, 9);
  for (const node of nodes) {
    const ports = node.data.ports;
    assert.equal(new Set(ports.map((p) => p.id)).size, ports.length);
    for (const port of ports) assert.ok(port.offset >= 0 && port.offset <= 100);
  }
  for (const edge of edges) {
    assert.ok(nodes.find((n) => n.id === edge.source).data.ports.some((p) => p.id === edge.sourceHandle));
    assert.ok(nodes.find((n) => n.id === edge.target).data.ports.some((p) => p.id === edge.targetHandle));
  }
  assert.notDeepEqual(edges[3].data.route.points, edges[8].data.route.points);
});

test('layout supports cycles, self connections, disconnected nodes and empty graphs', () => {
  const { nodes, edges } = fixture([...connections, ['db', 'api', 'returns'], ['cache', 'cache', 'expires']]);
  assert.equal(nodes.length, 5);
  for (const edge of edges) {
    assert.ok(edge.data.route.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
    assert.ok(Number.isFinite(edge.data.route.label.x));
  }
  assert.equal(fixture([]).nodes.length, 5);
  assert.deepEqual(getArchitectureLayout([], []), { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 } });
});

test('layout is deterministic and does not mutate architecture input', () => {
  const nodes = [{ id: 'a', data: { label: 'A' }, position: { x: 0, y: 0 } }];
  const original = structuredClone(nodes);
  assert.deepEqual(getArchitectureLayout(nodes, []), getArchitectureLayout(nodes, []));
  assert.deepEqual(nodes, original);
});

test('the Express / Redis graph keeps its clearances within compact bounds', () => {
  const { bounds, nodes } = fixture();
  assert.ok(bounds.height <= 900, `graph is ${bounds.height}px tall`);
  assert.ok(bounds.width <= 1000, `graph is ${bounds.width}px wide`);
  assert.ok(nodes.every((node) => node.style.width === 220 && node.style.height === 84));
});

test('fitting includes nodes, outer connections and tags above the iteration bar', () => {
  const graph = fixture();
  const boxes = [...graph.nodes.map(nodeBox), ...graph.edges.map(labelBox)];
  for (const edge of graph.edges) for (const point of edge.data.route.points) {
    boxes.push({ ...point, width: 0, height: 0 });
  }
  for (const [width, height] of [[1440, 720], [800, 600], [326, 400]]) {
    const viewport = getArchitectureViewport(graph.bounds, width, height);
    for (const box of boxes) {
      const left = box.x * viewport.zoom + viewport.x;
      const top = box.y * viewport.zoom + viewport.y;
      const right = (box.x + box.width) * viewport.zoom + viewport.x;
      const bottom = (box.y + box.height) * viewport.zoom + viewport.y;
      assert.ok(left >= 24 && right <= width - 24, `clipped horizontally at ${width}px`);
      assert.ok(top >= 48 && bottom <= height - 88, `clipped vertically at ${height}px`);
    }
  }
});

test('a deep graph can fit below the old minimum zoom without clipping its last node', () => {
  const nodes = Array.from({ length: 16 }, (_, index) => ({
    id: String(index), data: { label: `Service ${index}` }, position: { x: 0, y: 0 },
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: String(index), source: nodes[index].id, target: node.id, label: 'calls',
  }));
  const graph = getArchitectureLayout(nodes, edges);
  const viewport = getArchitectureViewport(graph.bounds, 1024, 600);
  assert.ok(viewport.zoom < 0.5);
  const bottom = (graph.bounds.y + graph.bounds.height) * viewport.zoom + viewport.y;
  assert.ok(bottom <= 600 - 88, `last row is clipped at ${bottom}px`);
  const initial = getArchitectureInitialViewport(graph.bounds, 1024, 600);
  assert.ok(initial.zoom < ARCHITECTURE_INITIAL_MAX_ZOOM);
  assert.ok((graph.bounds.y + graph.bounds.height) * initial.zoom + initial.y <= 600 - 88);
});

test('initial view caps small graphs at 0.65 without limiting the explicit Fit control', () => {
  const graph = getArchitectureLayout([{ id: 'api', data: { label: 'API' }, position: { x: 0, y: 0 } }], []);
  assert.equal(getArchitectureInitialViewport(graph.bounds, 1024, 600).zoom, ARCHITECTURE_INITIAL_MAX_ZOOM);
  assert.equal(getArchitectureViewport(graph.bounds, 1024, 600).zoom, 1);
});

test('long captions have capped layout boxes and do not widen the graph with text length', () => {
  const shortLong = connections.map((edge) => [...edge]);
  const veryLong = connections.map((edge) => [...edge]);
  shortLong[3][2] = 'Writes persistent application data through a managed connection pool';
  veryLong[3][2] = shortLong[3][2].repeat(30);
  const a = fixture(shortLong), b = fixture(veryLong);
  assert.equal(a.edges[3].data.route.labelWidth, 176);
  assert.equal(b.edges[3].data.route.labelWidth, 176);
  assert.deepEqual(a.bounds, b.bounds);
  for (const edge of b.edges) {
    assert.ok(edge.data.route.labelWidth <= 176);
    assert.equal(edge.data.route.labelHeight, 32);
  }
});

test('unlabeled connections have finite routes without reserving invisible tag boxes', () => {
  const { edges } = fixture(connections.map(([from, to]) => [from, to, undefined]));
  for (const edge of edges) {
    assert.equal(edge.data.route.labelWidth, 0);
    assert.equal(edge.data.route.labelHeight, 0);
    assert.ok(Number.isFinite(edge.data.route.label.x) && Number.isFinite(edge.data.route.label.y));
    assert.ok(!getArchitectureEdgePath(edge.data.route.points, edge.data.route.label).includes('NaN'));
  }
  assert.deepEqual(getArchitectureLabelSize(''), { width: 0, height: 0 });
});

test('branching services, multiple parents and cross-service connections fit narrow viewports', () => {
  const nodes = ['web', 'api', 'auth', 'cache', 'queue', 'worker', 'db', 'infra'].map((id) => ({
    id, data: { label: id }, position: { x: 0, y: 0 },
  }));
  const relationships = [
    ['web', 'api'], ['api', 'auth'], ['api', 'cache'], ['api', 'queue'],
    ['auth', 'db'], ['cache', 'db'], ['queue', 'worker'], ['worker', 'db'],
    ['worker', 'cache'], ['api', 'db'], ['web', 'infra'], ['api', 'infra'], ['db', 'infra'],
  ];
  const graph = getArchitectureLayout(nodes, relationships.map(([source, target], index) => ({
    id: String(index), source, target,
    label: index % 2 ? 'Cross-service relationship with a very long description'.repeat(4) : 'calls',
  })));
  const boxes = [...graph.nodes.map(nodeBox), ...graph.edges.map(labelBox)];
  for (const edge of graph.edges) for (const point of edge.data.route.points) boxes.push({ ...point, width: 0, height: 0 });
  for (const [width, height] of [[1440, 720], [800, 600], [326, 400]]) {
    const viewport = getArchitectureViewport(graph.bounds, width, height);
    for (const box of boxes) {
      assert.ok(box.x * viewport.zoom + viewport.x >= 24);
      assert.ok((box.x + box.width) * viewport.zoom + viewport.x <= width - 24);
      assert.ok(box.y * viewport.zoom + viewport.y >= 48);
      assert.ok((box.y + box.height) * viewport.zoom + viewport.y <= height - 88);
    }
  }
});
