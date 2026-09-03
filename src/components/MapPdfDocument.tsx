import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { MapprSystem } from '@/lib/api';

const ACCENT = {
  trace: '#0f7ea3', 
  signal: '#c97a0e', 
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: '#111827',
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  summary: { fontSize: 11, color: '#374151', marginBottom: 16 },
  h2: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: ACCENT.trace,
    marginTop: 20,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: ACCENT.trace,
    paddingBottom: 4,
  },
  h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 2 },
  body: { fontSize: 10, color: '#374151', marginBottom: 4, lineHeight: 1.4 },
  listItem: { fontSize: 10, color: '#374151', marginBottom: 3, lineHeight: 1.4 },
  connection: { fontFamily: 'Courier', fontSize: 9, color: ACCENT.trace },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 2,
  },
  tableCellName: { width: '50%', fontSize: 9 },
  tableCellType: { width: '50%', fontSize: 9, color: '#6b7280' },
  phaseBadge: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: ACCENT.signal },
});

export function MapPdfDocument({ data }: { data: MapprSystem }) {
  const nodeLabelById = new Map(data.architecture.nodes.map((n) => [n.id, n.label]));
  const entityNameById = new Map(data.dataModel.entities.map((e) => [e.id, e.name]));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{data.meta.productName}</Text>
        <Text style={styles.summary}>{data.meta.oneLineSummary}</Text>

        <Text style={styles.h2}>Overview</Text>
        <Text style={styles.body}>{data.product.summary}</Text>

        <Text style={styles.h2}>Users</Text>
        {data.users.map((user) => (
          <Text key={user.id} style={styles.listItem}>
            • {user.name} — {user.description}
          </Text>
        ))}

        <Text style={styles.h2}>Features</Text>
        {data.features.map((feature) => (
          <Text key={feature.id} style={styles.listItem}>
            • {feature.name} — {feature.description}
          </Text>
        ))}

        <Text style={styles.h2}>Tech Stack</Text>
        {data.techStack.map((item) => (
          <Text key={item.category} style={styles.listItem}>
            • {item.category}: {item.choice} — {item.rationale}
          </Text>
        ))}
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Architecture</Text>
        {data.architecture.nodes.map((node) => {
          const outgoing = data.architecture.edges.filter((edge) => edge.from === node.id);
          const incoming = data.architecture.edges.filter((edge) => edge.to === node.id);
          return (
            <View key={node.id} style={{ marginBottom: 10 }}>
              <Text style={styles.h3}>
                {node.label} ({node.type})
              </Text>
              <Text style={styles.body}>{node.description}</Text>
              {outgoing.map((edge, i) => (
                <Text key={`out-${i}`} style={styles.connection}>
                  → {nodeLabelById.get(edge.to) ?? edge.to}
                  {edge.label ? ` (${edge.label})` : ''}
                </Text>
              ))}
              {incoming.map((edge, i) => (
                <Text key={`in-${i}`} style={styles.connection}>
                  ← {nodeLabelById.get(edge.from) ?? edge.from}
                  {edge.label ? ` (${edge.label})` : ''}
                </Text>
              ))}
            </View>
          );
        })}

        <Text style={styles.h2}>Database</Text>
        {data.dataModel.entities.map((entity) => {
          const relations = data.dataModel.relations.filter(
            (relation) => relation.from === entity.id || relation.to === entity.id
          );
          return (
            <View key={entity.id} style={{ marginBottom: 10 }}>
              <Text style={styles.h3}>{entity.name}</Text>
              {entity.fields.map((field) => (
                <View key={field.name} style={styles.tableRow}>
                  <Text style={styles.tableCellName}>{field.name}</Text>
                  <Text style={styles.tableCellType}>{field.type}</Text>
                </View>
              ))}
              {relations.map((relation, i) => {
                const isOutgoing = relation.from === entity.id;
                const connectedId = isOutgoing ? relation.to : relation.from;
                return (
                  <Text key={i} style={styles.connection}>
                    {isOutgoing ? '→' : '←'} {entityNameById.get(connectedId) ?? connectedId} (
                    {relation.type}
                    {relation.label ? ` — ${relation.label}` : ''})
                  </Text>
                );
              })}
            </View>
          );
        })}
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Design System</Text>

        <Text style={styles.h3}>Colors</Text>
        {data.designSystem.colors.map((color) => (
          <Text key={color.token} style={styles.listItem}>
            • {color.token}: {color.value}
          </Text>
        ))}

        <Text style={styles.h3}>Typography</Text>
        {data.designSystem.typography.map((type) => (
          <Text key={type.token} style={styles.listItem}>
            • {type.token}: {type.value}
          </Text>
        ))}

        <Text style={styles.h3}>Spacing</Text>
        {data.designSystem.spacing.map((space) => (
          <Text key={space.token} style={styles.listItem}>
            • {space.token}: {space.value}
          </Text>
        ))}

        <Text style={styles.h3}>Components</Text>
        {data.designSystem.components.map((component) => (
          <Text key={component.name} style={styles.listItem}>
            • {component.name} — {component.description}
          </Text>
        ))}

        <Text style={styles.h2}>Development Plan</Text>
        {[...data.developmentPlan]
          .sort((a, b) => a.phase - b.phase)
          .map((phase) => (
            <View key={phase.phase} style={{ marginBottom: 10 }}>
              <Text style={styles.phaseBadge}>
                Phase {phase.phase}: {phase.title}
              </Text>
              {phase.items.map((item, i) => (
                <Text key={i} style={styles.listItem}>
                  ☐ {item}
                </Text>
              ))}
            </View>
          ))}
      </Page>
    </Document>
  );
}