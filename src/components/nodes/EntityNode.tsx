'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export type EntityNodeData = {
  name: string;
  fields: { name: string; type: string }[];
  isFocused?: boolean;
  isConnected?: boolean;
  isDimmed?: boolean;
};

// Handle positions hardcoded Top/Bottom, same reasoning as ArchitectureNode
// — layout.ts only runs 'TB' for now, no horizontal-layout toggle yet.
export function EntityNode({ data }: NodeProps) {
  const { name, fields, isFocused, isConnected, isDimmed } = data as unknown as EntityNodeData;

  return (
    <div
      className="min-w-[220px] rounded-lg border border-trace/40 bg-surface-raised px-4 py-3 shadow-lg"
      style={{
        borderColor: isFocused
          ? 'var(--color-signal)'
          : isConnected ? 'var(--color-trace)' : isDimmed ? 'var(--color-canvas-grid)' : undefined,
        backgroundColor: isFocused
          ? 'color-mix(in srgb, var(--color-signal) 14%, var(--color-surface-raised))'
          : isConnected
            ? 'color-mix(in srgb, var(--color-trace) 6%, var(--color-surface-raised))'
            : undefined,
        boxShadow: isFocused
          ? '0 0 0 4px var(--color-signal)'
          : isConnected
            ? '0 0 0 2px color-mix(in srgb, var(--color-trace) 50%, transparent)'
            : undefined,
        transition: 'border-color var(--motion-fast) var(--motion-ease-standard), '
          + 'background-color var(--motion-fast) var(--motion-ease-standard), '
          + 'box-shadow var(--motion-fast) var(--motion-ease-standard)',
      }}
    >
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
