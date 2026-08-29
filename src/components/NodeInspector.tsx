'use client';

import { XIcon } from '@phosphor-icons/react';

type Connection = {
  direction: 'in' | 'out';
  label?: string;
  connectedLabel: string;
};

type NodeInspectorProps = {
  label: string;
  type: string;
  description?: string;
  connections: Connection[];
  onClose: () => void;
};

export function NodeInspector({
  label,
  type,
  description,
  connections,
  onClose,
}: NodeInspectorProps) {
  return (
    <div className="absolute right-0 top-0 h-full w-80 overflow-y-auto border-l border-canvas-grid bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">{type}</p>
          <h3 className="font-display text-lg font-semibold text-text">{label}</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close inspector"
          className="rounded p-1 text-text-muted hover:bg-surface-raised hover:text-text"
        >
          <XIcon size={16} />
        </button>
      </div>

      {description && <p className="mb-6 font-body text-sm text-text-muted">{description}</p>}

      {connections.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-muted">
            Connections
          </p>
          <ul className="flex flex-col gap-2">
            {connections.map((conn, index) => (
              <li
                key={index}
                className="rounded bg-surface-raised px-3 py-2 font-mono text-xs text-text"
              >
                <span className="text-trace">{conn.direction === 'out' ? '→' : '←'}</span>{' '}
                {conn.connectedLabel}
                {conn.label && <span className="block text-text-muted">{conn.label}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}