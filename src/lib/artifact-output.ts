import { ArtifactSafetyError, sameArtifact, safeArtifactFilename } from './artifact-safety';

export type ArtifactFile = { filename: string; content: string; mimeType: string };
export async function checkedArtifactDownload<T>({ current, read, render, valid, deliver }: {
  current: boolean; read: () => Promise<T>; render: (record: T) => Promise<ArtifactFile>;
  valid: (record: T) => boolean; deliver: (file: ArtifactFile) => void;
}) {
  if (!current) throw new ArtifactSafetyError('Download is disabled for saved or unverified output. Refresh current output first.');
  const fresh = await read();
  if (!valid(fresh)) return false;
  const file = await render(fresh);
  const after = await read();
  if (!sameArtifact(fresh, after)) throw new ArtifactSafetyError('The artifact changed during download. Refresh and try the download again.');
  if (!valid(after)) return false;
  deliver({ ...file, filename: safeArtifactFilename(file.filename) });
  return true;
}
export async function checkedArtifactCopy<T>(current: boolean, displayed: T, read: () => Promise<T>, valid: (record: T) => boolean) {
  if (!current) throw new ArtifactSafetyError('Copy is disabled for saved or unverified output. Refresh current output first.');
  const fresh = await read();
  if (!valid(fresh) || !sameArtifact(fresh, displayed)) throw new ArtifactSafetyError('The displayed content changed. Refresh before copying.');
}
