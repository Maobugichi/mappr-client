import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FindingSeverity } from '@/lib/api';

export type ArchitectureNodeData = {
  label: string;
  type: string;
  // Set when this node is affected by the finding currently active in
  // the review panel — undefined/false the rest of the time, so the
  // default rendering is untouched.
  highlightSeverity?: FindingSeverity;
};

// Reuses the existing design tokens rather than introducing new colors:
// trace (calm/low), signal (the existing "active" accent, for medium),
// danger (for high/critical, with critical getting a heavier border).
const SEVERITY_STYLES: Record<FindingSeverity, { border: string; borderWidth: string }> = {
  low: { border: 'var(--color-trace)', borderWidth: '2px' },
  medium: { border: 'var(--color-signal)', borderWidth: '2px' },
  high: { border: 'var(--color-danger)', borderWidth: '2px' },
  critical: { border: 'var(--color-danger)', borderWidth: '3px' },
};

export function ArchitectureNode({ data }: NodeProps) {
  const { label, type, highlightSeverity } = data as unknown as ArchitectureNodeData;
  const highlight = highlightSeverity ? SEVERITY_STYLES[highlightSeverity] : null;

  return (
    <div
      className="min-w-[180px] rounded-lg border border-trace/40 bg-surface-raised px-4 py-3 shadow-lg transition-colors"
      style={
        highlight
          ? {
              borderColor: highlight.border,
              borderWidth: highlight.borderWidth,
              boxShadow: `0 0 0 2px color-mix(in srgb, ${highlight.border} 25%, transparent)`,
            }
          : undefined
      }
    >
      <Handle type="target" position={Position.Top} className="!bg-trace" />
      <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">{type}</p>
      <p className="font-display text-sm font-medium text-text">{label}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-trace" />
    </div>
  );
}