import { assertTrackedArtifact, ArtifactSafetyError, ArtifactMutationError, sameArtifact } from './artifact-safety';

// Inspection never calls a current-only renderer or joins saved prose to live
// map/support data. Current documents retain the server's exact omission notes.
export async function artifactDocument<T extends { mapId: string }>(
  record: T | null, read: () => Promise<T | null>, render: (record: T) => Promise<string>, inspection = false,
) {
  if (!record) return null;
  assertTrackedArtifact(record, record.mapId, 'inspection');
  if (record.inspectionOnly || inspection) return { ...record, record, markdown: null };
  const markdown = await render(record);
  const after = await read();
  if (!sameArtifact(record, after)) throw new ArtifactSafetyError('The artifact changed while its document was being rendered. Refresh the preview.');
  return { ...record, record, markdown };
}

export async function generateArtifactDocument<T extends { mapId: string }>(
  generate: () => Promise<T>, read: () => Promise<T | null>, render: (record: T) => Promise<string>,
) {
  try { return (await artifactDocument(await generate(), read, render))!; }
  catch (error) {
    if (error instanceof ArtifactMutationError && error.currentRecord) {
      let recovered = null;
      try { recovered = await artifactDocument(error.currentRecord as T, read, render); } catch { /* Preserve original error, never an unverified mixed document. */ }
      throw new ArtifactMutationError(error, recovered);
    }
    throw error;
  }
}
