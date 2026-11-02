import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Blockquote, Nodes, Root, RootContent } from 'mdast';

export type DeploymentDocument = { markdown: string; tree: Root; code: Map<number, string> };
type Section = { title: string; nodes: RootContent[] };

function text(node: Nodes): string {
  if ('value' in node) return node.value;
  return 'children' in node ? node.children.map(text).join('') : '';
}

function annotate(node: Nodes, kind: string) {
  node.data = { ...node.data, hProperties: { ...node.data?.hProperties, 'data-runbook': kind } };
}

// Use the same CommonMark parser as react-markdown. Sections retain every AST
// node, including definitions, unknown headings, warnings and future guidance.
// Only the backend's explicit section headings determine presentation order.
export function prepareDeploymentDocument(markdown: string): DeploymentDocument {
  const tree = fromMarkdown(markdown);
  const code = new Map<number, string>();
  function visit(node: Nodes) {
    if (node.type === 'code' && node.position?.start.offset !== undefined) code.set(node.position.start.offset, node.value);
    if (node.type === 'paragraph') {
      const value = text(node);
      if (/^(?:verify|verification):/i.test(value)) annotate(node, 'verification');
      else if (/^(?:warning|caution):|circular dependenc|dependency cycle|best.guess|uncertain.*order/i.test(value)) annotate(node, 'warning');
      else if (/^(?:steps|environment variables)$/.test(value.toLowerCase())) annotate(node, 'label');
    }
    if ('children' in node) node.children.forEach(visit);
  }
  visit(tree);

  const preamble: RootContent[] = [];
  const sections: Section[] = [];
  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth === 2) {
      sections.push({ title: text(node).trim().toLowerCase(), nodes: [node] });
    } else if (sections.length) sections[sections.length - 1].nodes.push(node);
    else preamble.push(node);
  }

  const runbooks = sections.find((section) => section.title === 'component runbooks');
  if (runbooks) {
    const nodes: RootContent[] = [];
    let component: Blockquote | undefined;
    for (const node of runbooks.nodes) {
      const number = node.type === 'heading' && node.depth === 3 ? /^(\d+)\.\s+/.exec(text(node)) : null;
      if (number && node.type === 'heading') {
        component = { type: 'blockquote', children: [], data: {
          hName: 'section', hProperties: { 'data-runbook': 'component' },
        } };
        // Move only the existing numeric prefix into the small sequence marker.
        // Leave unfamiliar heading formats untouched rather than guessing names.
        const first = node.children[0];
        if (first?.type === 'text' && first.value.startsWith(number[0])) {
          first.value = first.value.slice(number[0].length);
          node.data = { ...node.data, hProperties: { ...node.data?.hProperties, 'data-sequence': number[1] } };
        }
        component.children.push(node);
        nodes.push(component);
      } else if (component && !(node.type === 'heading' && node.depth === 3)) {
        if (component.children.length === 1 && node.type === 'paragraph'
          && /^(?:application|managed resource|external service|embedded)\b/i.test(text(node))) annotate(node, 'metadata');
        // fromMarkdown emits only block/definition nodes at the document root;
        // mdast's wider RootContent union also permits inline nodes in types.
        component.children.push(node as Blockquote['children'][number]);
      } else {
        component = undefined;
        nodes.push(node);
      }
    }
    runbooks.nodes = nodes;
  }

  const prerequisites = sections.filter((section) => section.title === 'before you start' || section.title === 'prerequisites');
  const connections = runbooks ? sections.filter((section) => section.title === 'how components connect') : [];
  const remaining = sections.filter((section) => !prerequisites.includes(section) && !connections.includes(section));
  const ordered: Section[] = [...prerequisites];
  for (const section of remaining) {
    ordered.push(section);
    if (section === runbooks) ordered.push(...connections);
  }
  tree.children = [...preamble, ...ordered.flatMap((section) => section.nodes)];
  // Relationship styling adds no new relationship data or inferred edges.
  connections.forEach((section) => section.nodes.forEach((node) => {
    if (node.type === 'list') annotate(node, 'connections');
  }));
  return { markdown, tree, code };
}
