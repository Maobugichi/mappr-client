'use client';

import { useEffect, useState } from 'react';
import { ArrowUpIcon, ClockCounterClockwiseIcon } from '@phosphor-icons/react';
import { getVersions, type VersionSummary } from '@/lib/api';

type IterationBarProps = {
  onSubmit: (instruction: string) => Promise<void>;
  isRunning: boolean;
  error: string | null;
  lastSummary: string | null;
  mapId: string;
  // Bumped by the parent whenever a new version lands, so the history
  // list re-fetches without this component needing to know why.
  refreshKey: number;
};

export function IterationBar({
  onSubmit,
  isRunning,
  error,
  lastSummary,
  mapId,
  refreshKey,
}: IterationBarProps) {
  const [instruction, setInstruction] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<VersionSummary[]>([]);

  useEffect(() => {
    if (!isHistoryOpen) return;
    let cancelled = false;
    getVersions(mapId)
      .then((result) => {
        if (!cancelled) setVersions(result);
      })
      .catch((err) => {
        console.error('Failed to load version history:', err);
      });
    return () => {
      cancelled = true;
    };
    // refreshKey intentionally included so a completed iteration
    // refreshes an already-open history list.
  }, [mapId, isHistoryOpen, refreshKey]);

  const handleSubmit = async () => {
    const trimmed = instruction.trim();
    if (!trimmed || isRunning) return;
    await onSubmit(trimmed);
    setInstruction('');
  };

  return (
    <div className="flex w-[480px] max-w-[90vw] flex-col gap-2">
      {isHistoryOpen && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-canvas-grid bg-surface p-3 shadow-lg">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-muted">
            Version History
          </p>
          {versions.length === 0 ? (
            <p className="font-body text-xs text-text-muted">No iterations yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {versions.map((v) => (
                <li key={v.version} className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[10px] text-trace">v{v.version}</span>
                  <span className="font-body text-xs text-text">{v.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(lastSummary || error) && (
        <div
          className={`rounded-lg border px-3 py-2 font-body text-xs shadow-lg ${
            error ? 'border-danger bg-surface text-danger' : 'border-canvas-grid bg-surface text-text-muted'
          }`}
        >
          {error ?? lastSummary}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-full border border-canvas-grid bg-surface px-2 py-1.5 shadow-lg">
        <button
          onClick={() => setIsHistoryOpen((v) => !v)}
          aria-label="Toggle version history"
          className={`shrink-0 rounded-full p-1.5 transition-colors ${
            isHistoryOpen ? 'bg-signal text-canvas' : 'text-text-muted hover:bg-surface-raised'
          }`}
        >
          <ClockCounterClockwiseIcon size={16} />
        </button>

        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          disabled={isRunning}
          placeholder="Describe a change to the architecture…"
          className="flex-1 bg-transparent font-body text-sm text-text placeholder:text-text-muted focus:outline-none disabled:opacity-60"
        />

        <button
          onClick={handleSubmit}
          disabled={isRunning || !instruction.trim()}
          aria-label="Apply change"
          className="shrink-0 rounded-full bg-signal p-1.5 text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <ArrowUpIcon size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}