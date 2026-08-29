'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export type EntityNodeData = {
  name: string;
  fields: { name: string; type: string }[];
};

// Handle positions hardcoded Top/Bottom, same reasoning as ArchitectureNode
// — layout.ts only runs 'TB' for now, no horizontal-layout toggle yet.
export function EntityNode({ data }: NodeProps) {
  const { name, fields } = data as unknown as EntityNodeData;

  return (
    <div className="min-w-[220px] rounded-lg border border-trace/40 bg-surface-raised px-4 py-3 shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-trace" />

      <p className="mb-2 font-display text-sm font-semibold text-text">{name}</p>

      <ul className="flex flex-col gap-0.5 border-t border-canvas-grid pt-2">
        {fields.map((field) => (
          <li
            key={field.name}
            className="flex items-center justify-between gap-3 font-mono text-[11px]"
          >
            <span className="text-text">{field.name}</span>
            <span className="text-text-muted">{field.type}</span>
          </li>
        ))}
      </ul>

      <Handle type="source" position={Position.Bottom} className="!bg-trace" />
    </div>
  );
}