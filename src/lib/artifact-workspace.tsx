'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GeneratedArtifactCache } from './generated-artifact-cache';

const ArtifactWorkspace = createContext<GeneratedArtifactCache | null>(null);

export function ArtifactWorkspaceProvider({ mapId, source, children }: {
  mapId: string; source: object; children: ReactNode;
}) {
  const cache = useMemo(() => new GeneratedArtifactCache(mapId, source), [mapId, source]);
  return <ArtifactWorkspace.Provider value={cache}>{children}</ArtifactWorkspace.Provider>;
}

export function useArtifactCache(mapId: string) {
  const workspace = useContext(ArtifactWorkspace);
  return useMemo(() => workspace?.mapId === mapId ? workspace : new GeneratedArtifactCache(mapId), [workspace, mapId]);
}

export function usePreservedViewState<T>(key: string, initial: T | (() => T)) {
  const workspace = useContext(ArtifactWorkspace);
  const [value, setValue] = useState<T>(() => workspace?.viewState.has(key)
    ? workspace.viewState.get(key) as T
    : typeof initial === 'function' ? (initial as () => T)() : initial);
  useEffect(() => { workspace?.viewState.set(key, value); }, [workspace, key, value]);
  return [value, setValue] as const;
}
