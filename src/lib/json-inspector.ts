export type JsonContainer = Record<string, unknown> | unknown[];
export type JsonEntry = {
  id: number;
  path: string;
  parent: string | null;
  name?: string;
  parentIsArray: boolean;
  displayPath: string;
  depth: number;
  value: unknown;
  children: string[];
  searchText: string;
};
export type JsonIndex = Map<string, JsonEntry>;
export type InspectorState = {
  source: unknown;
  mode: 'tree' | 'pretty';
  manualPaths: Set<string>;
  selectedPath: string;
  query: string;
  matchPath: string | null;
  searchClosed: Set<string>;
  mobileFindOpen: boolean;
};

export function isContainer(value: unknown): value is JsonContainer {
  return typeof value === 'object' && value !== null;
}

export function entriesOf(container: JsonContainer): [string, unknown][] {
  return Array.isArray(container)
    ? container.map((value, index) => [String(index), value])
    : Object.entries(container);
}

// JSON Pointer escaping avoids collisions, including slashes, tildes and lone
// surrogate code units. These internal IDs never become CSS selectors.
export function childPath(parent: string, key: string): string {
  return parent + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function propertyPath(parent: string, key: string, array: boolean): string {
  if (array) return parent + '[' + key + ']';
  return parent + (/^[A-Za-z_$][\w$]*$/.test(key) ? '.' + key : '[' + JSON.stringify(key) + ']');
}

// Index the actual document once, without copying its values or flattening the
// rendered hierarchy. Iteration also supports deeply nested generated JSON.
export function buildJsonIndex(data: unknown): JsonIndex {
  const index: JsonIndex = new Map();
  const pending: Omit<JsonEntry, 'id' | 'children' | 'searchText'>[] = [
    { path: '', parent: null, parentIsArray: false, displayPath: '$', depth: 0, value: data },
  ];
  while (pending.length) {
    const node = pending.pop()!;
    const entries = isContainer(node.value) ? entriesOf(node.value) : [];
    const primitive = isContainer(node.value) ? '' : typeof node.value === 'string' ? node.value : String(node.value);
    index.set(node.path, {
      ...node, id: index.size, children: entries.map(([key]) => childPath(node.path, key)),
      searchText: ((node.parentIsArray ? '' : node.name ?? '') + '\n' + primitive).toLowerCase(),
    });
    for (let i = entries.length - 1; i >= 0; i--) {
      const [name, value] = entries[i];
      pending.push({
        path: childPath(node.path, name), parent: node.path, name, value,
        parentIsArray: Array.isArray(node.value), depth: node.depth + 1,
        displayPath: propertyPath(node.displayPath, name, Array.isArray(node.value)),
      });
    }
  }
  return index;
}

// Preserve the existing depth definition: root is depth 0, and only nonempty
// containers with depth < maxDepth open. Collapse all therefore opens root only.
export function pathsToDepth(index: JsonIndex, maxDepth: number): Set<string> {
  return new Set(Array.from(index.values()).filter((node) => node.children.length && node.depth < maxDepth).map((node) => node.path));
}

export function findEntries(index: JsonIndex, query: string): JsonEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return Array.from(index.values()).filter((node) => node.searchText.includes(needle));
}

export function ancestorPaths(index: JsonIndex, path: string | null): Set<string> {
  const paths = new Set<string>();
  let parent = path === null ? null : index.get(path)?.parent;
  while (parent !== null && parent !== undefined) {
    paths.add(parent);
    parent = index.get(parent)?.parent;
  }
  return paths;
}

export function effectiveOpenPaths(manual: Set<string>, revealed: Set<string>, closed: Set<string>): Set<string> {
  const paths = new Set([...manual, ...revealed]);
  closed.forEach((path) => paths.delete(path));
  return paths;
}

export function visiblePaths(index: JsonIndex, open: Set<string>): Set<string> {
  const visible = new Set<string>(), pending = [''];
  while (pending.length) {
    const path = pending.pop()!, node = index.get(path);
    if (!node) continue;
    visible.add(path);
    if (open.has(path)) {
      for (let i = node.children.length - 1; i >= 0; i--) pending.push(node.children[i]);
    }
  }
  return visible;
}

export function initialInspectorState(source: unknown): InspectorState {
  return {
    source, mode: 'tree', manualPaths: new Set(['']), selectedPath: '',
    query: '', matchPath: null, searchClosed: new Set(), mobileFindOpen: false,
  };
}

export function reconcileInspectorState(state: InspectorState, source: unknown, index: JsonIndex): InspectorState {
  const validContainers = (paths: Set<string>) => new Set(Array.from(paths).filter((path) => index.get(path)?.children.length));
  return {
    ...state, source, manualPaths: validContainers(state.manualPaths), searchClosed: validContainers(state.searchClosed),
    selectedPath: index.has(state.selectedPath) ? state.selectedPath : '',
    matchPath: state.matchPath !== null && index.has(state.matchPath) ? state.matchPath : null,
  };
}

export function jsonValueText(value: unknown): string {
  const text = JSON.stringify(value, null, 2);
  if (text === undefined) throw new Error('This value is not representable as JSON.');
  return text;
}
