import type { MapprSystem } from './api';

export function generateMarkdown(data: MapprSystem): string {
  const lines: string[] = [];

  lines.push(`# ${data.meta.productName}`, '', data.meta.oneLineSummary, '');

  lines.push('## Overview', '', data.product.summary, '');
  if (data.product.concepts.length > 0) {
    lines.push(data.product.concepts.map((c) => `\`${c}\``).join(' · '), '');
  }

  lines.push('## Users', '');
  for (const user of data.users) {
    lines.push(`- **${user.name}** — ${user.description}`);
  }
  lines.push('');

  lines.push('## Features', '');
  for (const feature of data.features) {
    const deps =
      feature.dependsOn.length > 0
        ? ` _(depends on: ${feature.dependsOn
            .map((id) => data.features.find((f) => f.id === id)?.name ?? id)
            .join(', ')})_`
        : '';
    lines.push(`- **${feature.name}**${deps} — ${feature.description}`);
  }
  lines.push('');

  lines.push('## Architecture', '');
  const nodeLabelById = new Map(data.architecture.nodes.map((n) => [n.id, n.label]));
  for (const node of data.architecture.nodes) {
    lines.push(`### ${node.label} _(${node.type})_`, '', node.description, '');
    const outgoing = data.architecture.edges.filter((e) => e.from === node.id);
    const incoming = data.architecture.edges.filter((e) => e.to === node.id);
    for (const edge of outgoing) {
      lines.push(`- → ${nodeLabelById.get(edge.to) ?? edge.to}${edge.label ? ` (${edge.label})` : ''}`);
    }
    for (const edge of incoming) {
      lines.push(`- ← ${nodeLabelById.get(edge.from) ?? edge.from}${edge.label ? ` (${edge.label})` : ''}`);
    }
    lines.push('');
  }

  lines.push('## Tech Stack', '');
  for (const item of data.techStack) {
    lines.push(`- **${item.category}: ${item.choice}** — ${item.rationale}`);
  }
  lines.push('');

  lines.push('## Database', '');
  const entityNameById = new Map(data.dataModel.entities.map((e) => [e.id, e.name]));
  for (const entity of data.dataModel.entities) {
    lines.push(`### ${entity.name}`, '');
    lines.push('| Field | Type |', '|---|---|');
    for (const field of entity.fields) {
      lines.push(`| ${field.name} | ${field.type} |`);
    }
    lines.push('');
    const relations = data.dataModel.relations.filter(
      (r) => r.from === entity.id || r.to === entity.id
    );
    for (const relation of relations) {
      const isOutgoing = relation.from === entity.id;
      const connectedId = isOutgoing ? relation.to : relation.from;
      const arrow = isOutgoing ? '→' : '←';
      const connectedName = entityNameById.get(connectedId) ?? connectedId;
      const labelPart = relation.label ? ` — ${relation.label}` : '';
      lines.push(`- ${arrow} ${connectedName} (${relation.type}${labelPart})`);
    }
    lines.push('');
  }

  lines.push('## Design System', '');
  lines.push('**Colors**', '');
  for (const color of data.designSystem.colors) {
    lines.push(`- \`${color.token}\`: ${color.value}`);
  }
  lines.push('', '**Typography**', '');
  for (const type of data.designSystem.typography) {
    lines.push(`- \`${type.token}\`: ${type.value}`);
  }
  lines.push('', '**Spacing**', '');
  for (const space of data.designSystem.spacing) {
    lines.push(`- \`${space.token}\`: ${space.value}`);
  }
  lines.push('', '**Components**', '');
  for (const component of data.designSystem.components) {
    lines.push(`- **${component.name}** — ${component.description}`);
  }
  lines.push('');

  lines.push('## Development Plan', '');
  const featureNameById = new Map(data.features.map((f) => [f.id, f.name]));
  const sortedPhases = [...data.developmentPlan].sort((a, b) => a.phase - b.phase);
  for (const phase of sortedPhases) {
    lines.push(`### Phase ${phase.phase}: ${phase.title}`, '');
    for (const item of phase.items) {
      const related =
        item.relatedFeatures.length > 0
          ? ` _(${item.relatedFeatures
              .map((id) => featureNameById.get(id) ?? id)
              .join(', ')})_`
          : '';
      lines.push(`- [ ] ${item.description}${related}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}