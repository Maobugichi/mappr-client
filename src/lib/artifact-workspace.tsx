'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GeneratedArtifactCache } from './generated-artifact-cache';
import { createTrackedArtifactCache, type ArtifactAuthority } from './tracked-artifact-cache';

const ArtifactWorkspace = createContext<GeneratedArtifactCache | null>(null);

export function ArtifactWorkspaceProvider({ mapId, source, authority, sessionContext, children }: {
  mapId: string; source: object; authority: ArtifactAuthority; sessionContext: string; children: ReactNode;
}) {
  // An in-memory session boundary, never a cookie/actor ID. Foreground return
  // drops private inspection and pending downloads before revalidating reads.
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const revision = authority.revision();
  const cache = useMemo(() => createTrackedArtifactCache(mapId, { source, revision, sessionContext, sessionEpoch }, authority),
    [mapId, source, authority, revision, sessionContext, sessionEpoch]);
  useEffect(() => {
    const reset = () => { cache.retire(); setSessionEpoch((value) => value + 1); };
    window.addEventListener('focus', reset);
    window.addEventListener('pageshow', reset);
    return () => { window.removeEventListener('focus', reset); window.removeEventListener('pageshow', reset); };
  }, [cache]);
  useEffect(() => { cache.retain(); return () => cache.retire(); }, [cache]);
  return <ArtifactWorkspace.Provider value={cache}>{children}</ArtifactWorkspace.Provider>;
}

export function useArtifactCache(mapId: string) {
  const workspace = useContext(ArtifactWorkspace);
  return useMemo(() => workspace?.mapId === mapId ? workspace : createTrackedArtifactCache(mapId, undefined, {
    revision: () => null, refresh: async () => { throw new Error('A canonical workspace revision is required to verify artifacts.'); },
  }), [workspace, mapId]);
}

export function usePreservedViewState<T>(key: string, initial: T | (() => T)) {
  const workspace = useContext(ArtifactWorkspace);
  const [value, setValue] = useState<T>(() => workspace?.viewState.has(key)
    ? workspace.viewState.get(key) as T
    : typeof initial === 'function' ? (initial as () => T)() : initial);
  useEffect(() => { workspace?.viewState.set(key, value); }, [workspace, key, value]);
  return [value, setValue] as const;
}
