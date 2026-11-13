'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { inspectSavedArtifact } from './api';
import { useArtifactCache } from './artifact-workspace';
import { downloadTextFile } from './markdown-export';
import { ArtifactSafetyError, artifactErrorProvenance, type ArtifactKind, type ArtifactMetadata } from './artifact-safety';
import { checkedArtifactCopy, checkedArtifactDownload } from './artifact-output';
import type { GeneratedArtifactCache } from './generated-artifact-cache';

type ArtifactDownload = { filename: string; content: string; mimeType: string };
export type ArtifactSafetyState = {
  status: string; inspection: boolean; canExport: boolean; busy: boolean;
  sourceRevision: number | null; reason: string | null;
  inspect: () => void; current: () => void; verifyCopy: () => Promise<void>;
};

export function useGeneratedArtifact<T>({
  mapId, kind, load, generate, loadError, generationError, exportError,
}: {
  mapId: string; kind: ArtifactKind;
  load: (mapId: string, inspection?: boolean) => Promise<T | null>;
  generate: (mapId: string) => Promise<T>;
  loadError: string; generationError: string; exportError: string;
}) {
  const cache = useArtifactCache(mapId);
  const [inspectionScope, setInspectionScope] = useState<GeneratedArtifactCache | null>(null);
  const inspection = inspectionScope === cache;
  const currentEntry = cache.getTracked<T>(kind);
  const entry = inspection ? cache.getTracked<T>(kind, true) : currentEntry;
  const snapshot = useSyncExternalStore(entry.subscribe, entry.getSnapshot, entry.getSnapshot);
  const { record, isLoading, operation, failure, resultRevision, downloaded, status } = snapshot;
  const lifetime = useRef({ active: true });
  const focusTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const current = { active: true };
    lifetime.current = current;
    if (!inspection) {
      if (entry.getSnapshot().loaded) void entry.reload(() => load(mapId));
      else void entry.ensureLoaded(() => load(mapId));
    }
    return () => { current.active = false; focusTriggerRef.current = null; };
  }, [entry, inspection, load, mapId]);
  const needsLoad = !snapshot.loaded && snapshot.status === 'loading';
  useEffect(() => {
    if (needsLoad && !inspection) void currentEntry.ensureLoaded(() => load(mapId));
  }, [needsLoad, inspection, currentEntry, load, mapId]);
  useEffect(() => {
    if (operation || !focusTriggerRef.current) return;
    if (document.activeElement === document.body && focusTriggerRef.current.isConnected) focusTriggerRef.current.focus({ preventScroll: true });
    focusTriggerRef.current = null;
  }, [operation]);

  const rememberFocus = useCallback((trigger: HTMLButtonElement) => {
    focusTriggerRef.current = document.activeElement === trigger ? trigger : null;
  }, []);
  const runGeneration = useCallback((trigger: HTMLButtonElement) => {
    rememberFocus(trigger);
    setInspectionScope(null);
    return currentEntry.generate(() => generate(mapId));
  }, [currentEntry, generate, mapId, rememberFocus]);
  const runMutation = useCallback((task: () => Promise<T>) => { setInspectionScope(null); return currentEntry.generate(task); }, [currentEntry]);

  const checkedCurrent = useCallback(async () => {
    const fresh = await load(mapId);
    if (!fresh) throw new ArtifactSafetyError('No verified current artifact is available. No output was copied or downloaded.');
    await cache.verifyRecord(fresh);
    return fresh;
  }, [cache, load, mapId]);
  const runDownload = useCallback((trigger: HTMLButtonElement, render: (fresh: T) => Promise<ArtifactDownload>) => {
    if (inspection || status !== 'current') return Promise.resolve();
    rememberFocus(trigger);
    const current = lifetime.current;
    return entry.download(async () => {
      const epoch = entry.getEpoch();
      return checkedArtifactDownload({ current: !inspection && status === 'current', read: checkedCurrent, render,
        valid: (record) => current.active && entry.isEpoch(epoch) && cache.isCurrentRecord(record),
        deliver: (file) => downloadTextFile(file.filename, file.content, file.mimeType) });
    });
  }, [inspection, status, entry, checkedCurrent, cache, rememberFocus]);
  const verifyCopy = useCallback(async () => {
    if (inspection || status !== 'current' || operation || isLoading) throw new ArtifactSafetyError('Copy is disabled for unverified or inspection-only output.');
    const current = lifetime.current, epoch = entry.getEpoch();
    try { await checkedArtifactCopy(true, record, checkedCurrent, (latest) => current.active && entry.isEpoch(epoch) && cache.isCurrentRecord(latest)); }
    catch (error) {
      if (current.active && entry.isEpoch(epoch)) entry.outputFailed(error);
      throw error;
    }
  }, [inspection, status, operation, isLoading, entry, checkedCurrent, record, cache]);

  const runReload = useCallback((trigger?: HTMLButtonElement) => {
    if (trigger) rememberFocus(trigger);
    setInspectionScope(null);
    return currentEntry.getSnapshot().loaded ? currentEntry.reload(() => load(mapId)) : currentEntry.ensureLoaded(() => load(mapId));
  }, [currentEntry, load, mapId, rememberFocus]);
  const inspect = useCallback(() => {
    if (operation || isLoading) return;
    const saved = cache.getTracked<T>(kind, true);
    saved.invalidate();
    setInspectionScope(cache);
    void saved.ensureLoaded(() => inspectSavedArtifact(mapId, load));
  }, [operation, isLoading, cache, kind, mapId, load]);

  const cause = failure?.cause;
  const error = !failure ? null : cause instanceof Error ? cause.message
    : failure.kind === 'generate' ? generationError : failure.kind === 'download' ? exportError : loadError;
  const metadata = record as ArtifactMetadata | null;
  const errorProvenance = artifactErrorProvenance(cause);
  const safety: ArtifactSafetyState = {
    status, inspection, canExport: !inspection && status === 'current' && !operation && !isLoading,
    busy: isLoading || operation !== null, sourceRevision: errorProvenance.sourceRevision !== undefined ? errorProvenance.sourceRevision : metadata?.sourceRevision ?? null,
    reason: errorProvenance.reason ?? metadata?.freshness?.reason ?? null, inspect, current: () => { void runReload(); }, verifyCopy,
  };
  return {
    record, isLoading, error, resultRevision, downloaded, safety, runMutation,
    isRunning: operation === 'generate', isDownloading: operation === 'download', isReloading: operation === 'reload',
    isWorking: operation !== null, runGeneration, runDownload, runReload,
  };
}
