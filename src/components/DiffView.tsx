'use client';

import { useState } from 'react';
import { XIcon, CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react';
import type { ArrayDiff, SimpleArrayDiff, SystemDiff } from '@/lib/api';

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(count > 0 && count <= 8);
  if (count === 0) return null;

  return (
    <div className="border-b border-canvas-grid py-2 last:border-b-0">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        {isOpen ? <CaretDownIcon size={12} /> : <CaretRightIcon size={12} />}
        <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
          {title}
        </span>
        <span className="font-mono text-[11px] text-trace">({count})</span>
      </button>
      {isOpen && <div className="mt-2 ml-4 flex flex-col gap-1">{children}</div>}
    </div>
  );
}

function AddedLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body text-xs text-success">
      <span className="font-mono">+ </span>
      {children}
    </p>
  );
}

function RemovedLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body text-xs text-danger line-through decoration-danger/50">
      <span className="font-mono no-underline">− </span>
      {children}
    </p>
  );
}

function ChangedLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body text-xs text-signal">
      <span className="font-mono">~ </span>
      {children}
    </p>
  );
}

function ArrayDiffList<T>({
  title,
  diff,
  labelFn,
}: {
  title: string;
  diff: ArrayDiff<T>;
  labelFn: (item: T) => string;
}) {
  const count = diff.added.length + diff.removed.length + diff.changed.length;
  return (
    <Section title={title} count={count}>
      {diff.added.map((item, i) => (
        <AddedLine key={`add-${i}`}>{labelFn(item)}</AddedLine>
      ))}
      {diff.removed.map((item, i) => (
        <RemovedLine key={`rem-${i}`}>{labelFn(item)}</RemovedLine>
      ))}
      {diff.changed.map((c, i) => (
        <ChangedLine key={`chg-${i}`}>
          {labelFn(c.after)} <span className="text-text-muted">({c.changedFields.join(', ')})</span>
        </ChangedLine>
      ))}
    </Section>
  );
}

function SimpleArrayDiffList<T>({
  title,
  diff,
  labelFn,
}: {
  title: string;
  diff: SimpleArrayDiff<T>;
  labelFn: (item: T) => string;
}) {
  const count = diff.added.length + diff.removed.length;
  return (
    <Section title={title} count={count}>
      {diff.added.map((item, i) => (
        <AddedLine key={`add-${i}`}>{labelFn(item)}</AddedLine>
      ))}
      {diff.removed.map((item, i) => (
        <RemovedLine key={`rem-${i}`}>{labelFn(item)}</RemovedLine>
      ))}
    </Section>
  );
}

export function DiffView({
  diff,
  from,
  to,
  onClose,
}: {
  diff: SystemDiff;
  from: number;
  to: number;
  onClose: () => void;
}) {
  return (
    <div className="absolute left-0 top-0 h-full w-[420px] overflow-y-auto border-r border-canvas-grid bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
            Diff
          </p>
          <h3 className="font-display text-lg font-semibold text-text">
            v{from} → v{to}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close diff"
          className="rounded p-1 text-text-muted hover:bg-surface-raised hover:text-text"
        >
          <XIcon size={16} />
        </button>
      </div>

      {!diff.hasChanges && (
        <p className="font-body text-xs text-text-muted">No differences between these versions.</p>
      )}

      {diff.meta.length > 0 && (
        <Section title="Meta" count={diff.meta.length}>
          {diff.meta.map((f, i) => (
            <ChangedLine key={i}>
              {f.field}: <span className="text-text-muted">{String(f.after)}</span>
            </ChangedLine>
          ))}
        </Section>
      )}

      {(diff.product.summary.length > 0 || diff.product.concepts.added.length > 0 || diff.product.concepts.removed.length > 0) && (
        <Section
          title="Product"
          count={diff.product.summary.length + diff.product.concepts.added.length + diff.product.concepts.removed.length}
        >
          {diff.product.summary.map((f, i) => (
            <ChangedLine key={`s-${i}`}>summary changed</ChangedLine>
          ))}
          {diff.product.concepts.added.map((c, i) => (
            <AddedLine key={`ca-${i}`}>{c}</AddedLine>
          ))}
          {diff.product.concepts.removed.map((c, i) => (
            <RemovedLine key={`cr-${i}`}>{c}</RemovedLine>
          ))}
        </Section>
      )}

      <ArrayDiffList title="Users" diff={diff.users} labelFn={(u) => u.name} />
      <ArrayDiffList title="Features" diff={diff.features} labelFn={(f) => f.name} />
      <ArrayDiffList title="Tech Stack" diff={diff.techStack} labelFn={(t) => `${t.category}: ${t.choice}`} />
      <ArrayDiffList
        title="Architecture Nodes"
        diff={diff.architecture.nodes}
        labelFn={(n) => n.label}
      />
      <SimpleArrayDiffList
        title="Architecture Edges"
        diff={diff.architecture.edges}
        labelFn={(e) => `${e.from} → ${e.to}${e.label ? ` (${e.label})` : ''}`}
      />
      <ArrayDiffList
        title="Data Model Entities"
        diff={diff.dataModel.entities}
        labelFn={(e) => e.name}
      />
      <SimpleArrayDiffList
        title="Data Model Relations"
        diff={diff.dataModel.relations}
        labelFn={(r) => `${r.from} → ${r.to} (${r.type})`}
      />
      <ArrayDiffList title="Colors" diff={diff.designSystem.colors} labelFn={(t) => t.token} />
      <ArrayDiffList
        title="Typography"
        diff={diff.designSystem.typography}
        labelFn={(t) => t.token}
      />
      <ArrayDiffList title="Spacing" diff={diff.designSystem.spacing} labelFn={(t) => t.token} />
      <ArrayDiffList
        title="Design Components"
        diff={diff.designSystem.components}
        labelFn={(c) => c.name}
      />

      {(diff.developmentPlan.added.length > 0 ||
        diff.developmentPlan.removed.length > 0 ||
        diff.developmentPlan.changed.length > 0) && (
        <Section
          title="Development Plan"
          count={
            diff.developmentPlan.added.length +
            diff.developmentPlan.removed.length +
            diff.developmentPlan.changed.length
          }
        >
          {diff.developmentPlan.added.map((p, i) => (
            <AddedLine key={`pa-${i}`}>Phase {p.phase}: {p.title}</AddedLine>
          ))}
          {diff.developmentPlan.removed.map((p, i) => (
            <RemovedLine key={`pr-${i}`}>Phase {p.phase}: {p.title}</RemovedLine>
          ))}
          {diff.developmentPlan.changed.map((c, i) => (
            <div key={`pc-${i}`}>
              <ChangedLine>
                Phase {c.phase}
                {c.titleChanged ? ' (title changed)' : ''}
              </ChangedLine>
              {c.items.added.map((item, j) => (
                <AddedLine key={`pci-add-${j}`}>{item.description}</AddedLine>
              ))}
              {c.items.removed.map((item, j) => (
                <RemovedLine key={`pci-rem-${j}`}>{item.description}</RemovedLine>
              ))}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}