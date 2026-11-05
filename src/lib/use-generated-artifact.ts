'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { ApiError } from './api';
import { useArtifactCache } from './artifact-workspace';
import { downloadTextFile } from './markdown-export';

type ArtifactDownload = { filename: string; content: string; mimeType: string };

export function useGeneratedArtifact<T>({
  mapId, load, generate, loadError, generationError, exportError,
}: {
  mapId: string;
  load: (mapId: string) => Promise<T | null>;
  generate: (mapId: string) => Promise<T>;
  loadError: string;
  generationError: string;
  exportError: string;
}) {
  const cache = useArtifactCache(mapId);
  const entry = cache.get(load);
  const { record, isLoading, operation, failure, resultRevision, downloaded } = useSyncExternalStore(
    entry.subscribe, entry.getSnapshot, entry.getSnapshot,
  );
  const lifetime = useRef({ active: true });
  const focusTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Downloads belong to the mounted reader; generation belongs to the cache.
    // A distinct lifetime also handles Strict Mode's effect replay safely.
    const current = { active: true };
    lifetime.current = current;
    void entry.ensureLoaded(() => load(mapId));
    return () => {
      current.active = false;
      focusTriggerRef.current = null;
    };
  }, [entry, load, mapId]);

  useEffect(() => {
    if (operation || !focusTriggerRef.current) return;
    if (document.activeElement === document.body && focusTriggerRef.current.isConnected) {
      focusTriggerRef.current.focus({ preventScroll: true });
    }
    focusTriggerRef.current = null;
  }, [operation]);

  const rememberFocus = useCallback((trigger: HTMLButtonElement) => {
    focusTriggerRef.current = document.activeElement === trigger ? trigger : null;
  }, []);

  const runGeneration = useCallback((trigger: HTMLButtonElement) => {
    rememberFocus(trigger);
    return entry.generate(() => generate(mapId));
  }, [entry, generate, mapId, rememberFocus]);

  const runDownload = useCallback((trigger: HTMLButtonElement, render: () => Promise<ArtifactDownload>) => {
    if (!record) return;
    rememberFocus(trigger);
    const current = lifetime.current;
    return entry.download(async () => {
      const file = await render();
      if (!current.active) return false;
      downloadTextFile(file.filename, file.content, file.mimeType);
      return true;
    });
  }, [entry, record, rememberFocus]);

  const runReload = useCallback((trigger: HTMLButtonElement) => {
    rememberFocus(trigger);
    return entry.reload(() => load(mapId));
  }, [entry, load, mapId, rememberFocus]);

  const error = !failure ? null : failure.kind === 'load' ? loadError
    : failure.cause instanceof ApiError ? (failure.cause.body.message ?? failure.cause.body.error)
    : failure.kind === 'generate' ? generationError : failure.kind === 'download' ? exportError : loadError;

  return {
    record, isLoading, error, resultRevision, downloaded,
    isRunning: operation === 'generate',
    isDownloading: operation === 'download',
    isReloading: operation === 'reload',
    isWorking: operation !== null,
    runGeneration, runDownload, runReload,
  };
}
