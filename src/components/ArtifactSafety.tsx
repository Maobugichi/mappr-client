'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import type { ArtifactSafetyState } from '@/lib/use-generated-artifact';

const Safety = createContext<(ArtifactSafetyState & { descriptionId: string }) | null>(null);
export const useArtifactSafety = () => useContext(Safety);
export function ArtifactStatus({ safety, id }: { safety: ArtifactSafetyState; id?: string }) {
  const status = safety.status === 'current' ? 'Verified current'
    : safety.status === 'inspection' ? 'Saved (out of date) — inspection only'
    : safety.status === 'missing' ? 'Not generated / not available'
    : safety.status === 'stale' ? 'Saved output is out of date'
    : safety.status === 'loading' ? 'Checking tracked output…' : 'Unavailable — currentness unverified';
  return <div className="mb-3 min-w-0 font-body text-xs leading-relaxed text-text-muted">
    <p id={id} role="status">{status}{safety.sourceRevision !== null ? ` · Source revision ${safety.sourceRevision}`
      : safety.status === 'inspection' ? ' · Source revision unverified' : ''}
      {safety.reason && safety.reason !== 'inputs_unchanged' ? ` · ${safety.reason.replaceAll('_', ' ')}` : ''}.
      {(!safety.canExport || safety.inspection) && ' Download and copy require verified current output. Saved inspection is read only.'}</p>
    <div className="mt-2 flex flex-wrap gap-3">
      <button type="button" className="min-h-10 rounded px-2 text-trace underline underline-offset-4 disabled:opacity-50"
        disabled={safety.busy} onClick={safety.current}>{safety.inspection ? 'Return to current output' : 'Refresh current output'}</button>
      {!safety.inspection && ['stale', 'unavailable'].includes(safety.status) && <button type="button"
        className="min-h-10 rounded px-2 text-trace underline underline-offset-4 disabled:opacity-50"
        disabled={safety.busy} onClick={safety.inspect}>Inspect saved output (owner only)</button>}
    </div>
  </div>;
}
export function ArtifactSafety({ safety, children }: { safety: ArtifactSafetyState; children: ReactNode }) {
  const id = useId();
  return <Safety.Provider value={{ ...safety, descriptionId: id }}><div className="min-w-0">
    <ArtifactStatus safety={safety} id={id} />{children}
  </div></Safety.Provider>;
}

export function SavedArtifactFields({ value }: { value: unknown }) {
  const omitted = ['mapId', 'techArchHash', 'createdAt', 'updatedAt', 'sourceRevision', 'currentRevision', 'freshness',
    'isCurrent', 'inspectionOnly', 'readMode', 'generationId', 'sourceFingerprint', 'generatorVersion', 'publishedAt'];
  const fields = value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.includes(key))) : value;
  return <div className="min-w-0" aria-label="Saved artifact fields">
    <p className="mb-2 font-body text-sm text-text-muted">Stored fields only. These have not been combined with current map data.</p>
    <pre tabIndex={0} className="max-w-full overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-text-muted">{JSON.stringify(fields, null, 2)}</pre>
  </div>;
}
