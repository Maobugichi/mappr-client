'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export type ArchitectureNodeData = {
  label: string;
  type: string;
};


export function ArchitectureNode({ data }: NodeProps) {
  const { label, type } = data as unknown as ArchitectureNodeData;

  return (
    <div className="min-w-[180px] rounded-lg border border-trace/40 bg-surface-raised px-4 py-3 shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-trace" />
      <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">{type}</p>
      <p className="font-display text-sm font-medium text-text">{label}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-trace" />
    </div>
  );
}