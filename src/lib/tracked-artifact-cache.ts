import { GeneratedArtifactCache } from './generated-artifact-cache';
import { assertTrackedArtifact, ArtifactMutationError, ArtifactSafetyError, artifactStatus } from './artifact-safety';

export type ArtifactAuthority = { revision: () => number | null; refresh: () => Promise<void> };
export function createTrackedArtifactCache(mapId: string, source: object | undefined, authority: ArtifactAuthority) {
  const scopeRevision = authority.revision();
  return new GeneratedArtifactCache(mapId, source, {
    verify: async (record, inspection) => {
      assertTrackedArtifact(record, mapId, inspection ? 'inspection' : 'current');
      // Artifact provenance cannot allocate or replace canonical revisions.
      if (record.currentRevision !== authority.revision()) await authority.refresh();
      if (record.currentRevision !== authority.revision() || authority.revision() !== scopeRevision) throw new ArtifactSafetyError('The map revision changed. Refresh the artifact in the current workspace before using it.', 'artifact_revision_changed');
    },
    status: artifactStatus,
    current: (record) => authority.revision() === scopeRevision && !!record && typeof record === 'object'
      && (record as { currentRevision?: unknown }).currentRevision === scopeRevision,
    recovered: (error) => error instanceof ArtifactMutationError ? error.currentRecord : null,
  });
}
