import type { ReactNode } from 'react';
import type { MapprSystem } from '@/lib/api';
import { Overview } from './Overview';
import { TechStackView } from './TechStackView';
import { DesignSystemView } from './DesignSystemView';
import { DevPlanView } from './DevPlanView';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <p className="font-mono text-xs uppercase tracking-widest text-trace">{title}</p>
      {children}
    </section>
  );
}

function UsersList({ users }: { users: MapprSystem['users'] }) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-canvas-grid bg-canvas p-4 sm:grid-cols-2">
      {users.map((user) => (
        <div key={user.id} className="rounded-lg border border-canvas-grid bg-surface-raised p-4">
          <p className="font-display text-sm font-semibold text-text">{user.name}</p>
          <p className="mt-1 font-body text-sm text-text-muted">{user.description}</p>
        </div>
      ))}
    </div>
  );
}

function ArchitectureList({ architecture }: { architecture: MapprSystem['architecture'] }) {
  const labelById = new Map(architecture.nodes.map((node) => [node.id, node.label]));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-canvas-grid bg-canvas p-4">
      {architecture.nodes.map((node) => {
        const outgoing = architecture.edges.filter((edge) => edge.from === node.id);
        const incoming = architecture.edges.filter((edge) => edge.to === node.id);

        return (
          <div
            key={node.id}
            className="rounded-lg border border-canvas-grid bg-surface-raised p-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
              {node.type}
            </p>
            <p className="font-display text-sm font-semibold text-text">{node.label}</p>
            <p className="mt-1 font-body text-sm text-text-muted">{node.description}</p>

            {(outgoing.length > 0 || incoming.length > 0) && (
              <div className="mt-2 flex flex-col gap-1">
                {outgoing.map((edge, index) => (
                  <p key={`out-${index}`} className="font-mono text-[11px] text-trace">
                    → {labelById.get(edge.to) ?? edge.to}
                    {edge.label ? ` (${edge.label})` : ''}
                  </p>
                ))}
                {incoming.map((edge, index) => (
                  <p key={`in-${index}`} className="font-mono text-[11px] text-trace">
                    ← {labelById.get(edge.from) ?? edge.from}
                    {edge.label ? ` (${edge.label})` : ''}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DatabaseList({ dataModel }: { dataModel: MapprSystem['dataModel'] }) {
  const nameById = new Map(dataModel.entities.map((entity) => [entity.id, entity.name]));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-canvas-grid bg-canvas p-4">
      {dataModel.entities.map((entity) => {
        const relations = dataModel.relations.filter(
          (relation) => relation.from === entity.id || relation.to === entity.id
        );

        return (
          <div
            key={entity.id}
            className="rounded-lg border border-canvas-grid bg-surface-raised p-4"
          >
            <p className="font-display text-sm font-semibold text-text">{entity.name}</p>
            <ul className="mt-2 flex flex-col gap-0.5 border-t border-canvas-grid pt-2">
              {entity.fields.map((field) => (
                <li key={field.name} className="flex justify-between font-mono text-[11px]">
                  <span className="text-text">{field.name}</span>
                  <span className="text-text-muted">{field.type}</span>
                </li>
              ))}
            </ul>

            {relations.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {relations.map((relation, index) => {
                  const isOutgoing = relation.from === entity.id;
                  const connectedId = isOutgoing ? relation.to : relation.from;
                  return (
                    <p key={index} className="font-mono text-[11px] text-trace">
                      {isOutgoing ? '→' : '←'} {nameById.get(connectedId) ?? connectedId} (
                      {relation.type}
                      {relation.label ? ` — ${relation.label}` : ''})
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AllView({ data }: { data: MapprSystem }) {
  return (
    <div className="flex flex-col gap-10">
      <Section title="Overview">
        <Overview product={data.product} features={data.features} />
      </Section>

      <Section title="Users">
        <UsersList users={data.users} />
      </Section>

      <Section title="Architecture">
        <ArchitectureList architecture={data.architecture} />
      </Section>

      <Section title="Tech Stack">
        <TechStackView techStack={data.techStack} />
      </Section>

      <Section title="Database">
        <DatabaseList dataModel={data.dataModel} />
      </Section>

      <Section title="Design System">
        <DesignSystemView designSystem={data.designSystem} />
      </Section>

      <Section title="Development Plan">
        <DevPlanView developmentPlan={data.developmentPlan} />
      </Section>
    </div>
  );
}