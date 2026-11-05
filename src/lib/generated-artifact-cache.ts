export type ArtifactOperation = 'generate' | 'download' | 'reload';
type RequestKind = ArtifactOperation | 'load';
type ArtifactLoader<T> = (mapId: string) => Promise<T | null>;

export type ArtifactSnapshot<T> = {
  record: T | null;
  loaded: boolean;
  isLoading: boolean;
  operation: ArtifactOperation | null;
  failure: { kind: RequestKind; cause: unknown } | null;
  resultRevision: number;
  downloaded: boolean;
};

// One entry owns the request, so unmounting a reader does not lose a successful
// response or permit another reader to start the same operation in parallel.
export class ArtifactEntry<T> {
  private snapshot: ArtifactSnapshot<T> = {
    record: null, loaded: false, isLoading: true, operation: null,
    failure: null, resultRevision: 0, downloaded: false,
  };
  private listeners = new Set<() => void>();
  private inFlight: Promise<void> | null = null;

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(patch: Partial<ArtifactSnapshot<T>>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private execute(kind: RequestKind, task: () => Promise<Partial<Pick<ArtifactSnapshot<T>, 'record' | 'downloaded'>>>) {
    this.inFlight = Promise.resolve().then(task).then((result) => {
      this.publish({
        ...result,
        loaded: 'record' in result ? true : this.snapshot.loaded,
        resultRevision: this.snapshot.resultRevision + (kind === 'generate' || kind === 'reload' ? 1 : 0),
      });
    }).catch((cause: unknown) => {
      this.publish({ failure: { kind, cause } });
    }).finally(() => {
      this.inFlight = null;
      this.publish({ isLoading: false, operation: null });
    });
    this.publish({ isLoading: kind === 'load', operation: kind === 'load' ? null : kind, failure: null, downloaded: false });
    return this.inFlight;
  }

  ensureLoaded(load: () => Promise<T | null>): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (this.snapshot.loaded) return Promise.resolve();
    return this.execute('load', async () => ({ record: await load() }));
  }

  generate(generate: () => Promise<T>): Promise<void> {
    if (this.snapshot.isLoading || this.inFlight) return Promise.resolve();
    return this.execute('generate', async () => ({ record: await generate() }));
  }

  reload(load: () => Promise<T | null>): Promise<void> {
    if (this.snapshot.isLoading || this.inFlight) return Promise.resolve();
    return this.execute('reload', async () => ({ record: await load() }));
  }

  download(download: () => Promise<boolean>): Promise<void> {
    if (!this.snapshot.record || this.snapshot.isLoading || this.inFlight) return Promise.resolve();
    return this.execute('download', async () => ({ downloaded: await download() }));
  }
}

// Owned by a single mounted workspace, never by module globals or browser
// storage. A different project or source-system revision gets a fresh cache.
export class GeneratedArtifactCache {
  readonly mapId: string;
  readonly source?: object;
  readonly viewState = new Map<string, unknown>();
  private artifacts = new Map<ArtifactLoader<unknown>, unknown>();

  constructor(mapId: string, source?: object) {
    this.mapId = mapId;
    this.source = source;
  }

  get<T>(load: ArtifactLoader<T>): ArtifactEntry<T> {
    let entry = this.artifacts.get(load) as ArtifactEntry<T> | undefined;
    if (!entry) {
      entry = new ArtifactEntry<T>();
      this.artifacts.set(load, entry);
    }
    return entry;
  }
}
