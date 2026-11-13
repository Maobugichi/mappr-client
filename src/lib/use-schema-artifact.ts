'use client';

import { useGeneratedArtifact } from './use-generated-artifact';
import type { ArtifactKind } from './artifact-safety';

export function useSchemaArtifact<T>(options: {
  mapId: string;
  kind: ArtifactKind;
  load: (mapId: string, inspection?: boolean) => Promise<T | null>;
  generate: (mapId: string) => Promise<T>;
  label: string;
  exportError: string;
}) {
  const { record, ...state } = useGeneratedArtifact({
    ...options,
    loadError: `Could not load the saved ${options.label}. Reopen this view to retry, or generate a new schema.`,
    generationError: `Something went wrong generating the ${options.label}.`,
  });
  return { schema: record, ...state };
}
