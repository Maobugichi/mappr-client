import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FindingSeverity } from '@/lib/api';
import type { ArchitecturePort } from '@/lib/architecture-layout';

export type ArchitectureNodeData = {
  label: string;
  type: string;
  ports?: ArchitecturePort[];
  // Set when this node is affected by the finding currently active in
  // the review panel — undefined/false the rest of the time, so the
  // default rendering is untouched.
  highlightSeverity?: FindingSeverity;
  isFocused?: boolean;
  isConnected?: boolean;
  isDimmed?: boolean;
};

// Severity owns the border and status marker; selection owns the amber
// outer ring, so a selected node retains its finding's severity.
const SEVERITY_STYLES: Record<FindingSeverity, { border: string; borderWidth: string }> = {
  low: { border: 'var(--color-trace)', borderWidth: '2px' },
  medium: { border: 'var(--color-severity-medium)', borderWidth: '2px' },
  high: { border: 'var(--color-danger)', borderWidth: '2px' },
  critical: { border: 'var(--color-danger)', borderWidth: '3px' },
};

export function ArchitectureNode({ data }: NodeProps) {
  const { label, type, ports = [], highlightSeverity, isFocused, isConnected, isDimmed } = data as unknown as ArchitectureNodeData;
  const highlight = highlightSeverity ? SEVERITY_STYLES[highlightSeverity] : null;

  const boxShadow = isFocused
    ? highlight
      ? '0 0 0 2px var(--color-canvas), 0 0 0 5px var(--color-signal)'
      : '0 0 0 4px var(--color-signal)'
    : highlight
      ? `0 0 0 2px color-mix(in srgb, ${highlight.border} 25%, transparent)`
      : isConnected
        ? '0 0 0 2px color-mix(in srgb, var(--color-trace) 50%, transparent)'
        : undefined;
  return (
    <div
      className="flex h-full w-full flex-col justify-center gap-1 rounded-lg border border-trace/40 bg-surface-raised px-4 py-3 shadow-lg transition-colors"
      style={{
        borderColor: highlight?.border ?? (isFocused
          ? 'var(--color-signal)'
          : isConnected ? 'var(--color-trace)' : isDimmed ? 'var(--color-canvas-grid)' : undefined),
        borderWidth: highlight?.borderWidth,
        backgroundColor: isFocused
          ? 'color-mix(in srgb, var(--color-signal) 14%, var(--color-surface-raised))'
          : isConnected
            ? 'color-mix(in srgb, var(--color-trace) 6%, var(--color-surface-raised))'
            : undefined,
        boxShadow,
        transition: 'border-color var(--motion-fast) var(--motion-ease-standard), '
          + 'background-color var(--motion-fast) var(--motion-ease-standard), '
          + 'box-shadow var(--motion-fast) var(--motion-ease-standard)',
      }}
    >
      {ports.map((port) => (
        <Handle key={port.id} id={port.id} type={port.type} position={port.position}
          className="!bg-trace"
          style={port.position === Position.Left || port.position === Position.Right
            ? { top: `${port.offset}%` } : { left: `${port.offset}%` }} />
      ))}
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-mono text-[11px] uppercase tracking-wide text-text-muted" title={type}>{type}</p>
        {highlight && (
          <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] capitalize text-text">
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: highlight.border }} />
            {highlightSeverity}<span className="sr-only"> severity</span>
          </span>
        )}
      </div>
      <p className="truncate font-display text-base font-semibold text-text" title={label}>{label}</p>
    </div>
  );
}
