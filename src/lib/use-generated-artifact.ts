'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import { downloadTextFile } from './markdown-export';

type ArtifactDownload = { filename: string; content: string; mimeType: string };
type Operation = 'generate' | 'download' | 'reload';

// The owning view is keyed by mapId. Unmounting invalidates pending work;
// generation and downloads share a lock so export contents stay consistent.
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
  const [record, setRecord] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultRevision, setResultRevision] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const operationRef = useRef<Operation | null>(null);
  const epochRef = useRef(0);
  const focusTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (operation || !focusTriggerRef.current) return;
    if (document.activeElement === document.body && focusTriggerRef.current.isConnected) {
      focusTriggerRef.current.focus({ preventScroll: true });
    }
    focusTriggerRef.current = null;
  }, [operation]);

  useEffect(() => {
    const epoch = ++epochRef.current;
    let cancelled = false;
    load(mapId)
      .then((existing) => {
        if (!cancelled) setRecord(existing);
      })
      .catch(() => {
        if (!cancelled) setError(loadError);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
      epochRef.current = epoch + 1;
    };
  }, [mapId, load, loadError]);

  const execute = useCallback(async (
    kind: Operation,
    trigger: HTMLButtonElement,
    task: (isCurrent: () => boolean) => Promise<void>,
  ) => {
    if (isLoading || operationRef.current) return;
    operationRef.current = kind;
    focusTriggerRef.current = document.activeElement === trigger ? trigger : null;
    const epoch = epochRef.current;
    const isCurrent = () => epoch === epochRef.current;
    setOperation(kind);
    setError(null);
    setDownloaded(false);
    try {
      await task(isCurrent);
    } catch (err) {
      if (isCurrent()) {
        setError(err instanceof ApiError
          ? (err.body.message ?? err.body.error)
          : kind === 'generate' ? generationError : kind === 'download' ? exportError : loadError);
      }
    } finally {
      operationRef.current = null;
      if (isCurrent()) setOperation(null);
    }
  }, [isLoading, generationError, exportError, loadError]);

  const runGeneration = useCallback((trigger: HTMLButtonElement) => execute('generate', trigger, async (isCurrent) => {
    const result = await generate(mapId);
    if (!isCurrent()) return;
    setRecord(result);
    setResultRevision((revision) => revision + 1);
  }), [execute, generate, mapId]);

  const runDownload = useCallback((trigger: HTMLButtonElement, render: () => Promise<ArtifactDownload>) => {
    if (!record) return;
    return execute('download', trigger, async (isCurrent) => {
      const file = await render();
      if (!isCurrent()) return;
      downloadTextFile(file.filename, file.content, file.mimeType);
      setDownloaded(true);
    });
  }, [execute, record]);

  const runReload = useCallback((trigger: HTMLButtonElement) => execute('reload', trigger, async (isCurrent) => {
    const existing = await load(mapId);
    if (!isCurrent()) return;
    setRecord(existing);
    setResultRevision((revision) => revision + 1);
  }), [execute, load, mapId]);

  return {
    record, isLoading, error, resultRevision, downloaded,
    isRunning: operation === 'generate',
    isDownloading: operation === 'download',
    isReloading: operation === 'reload',
    isWorking: operation !== null,
    runGeneration, runDownload, runReload,
  };
}
