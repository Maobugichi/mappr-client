export type ArtifactOperation = 'generate' | 'download' | 'reload';
type RequestKind = ArtifactOperation | 'load';
type ArtifactLoader<T> = (mapId: string) => Promise<T | null>;
export type ArtifactSafetyStatus = 'loading' | 'current' | 'inspection' | 'stale' | 'missing' | 'unavailable';
export type ArtifactPolicy = {
  check: (record: unknown) => Promise<void>;
  status: (error: unknown) => 'stale' | 'missing' | 'unavailable';
  recovered: (error: unknown) => unknown;
  published: () => void;
  inspection: boolean;
  current?: (record: unknown) => boolean;
};

export type ArtifactSnapshot<T> = {
  record: T | null;
  loaded: boolean;
  isLoading: boolean;
  operation: ArtifactOperation | null;
  failure: { kind: RequestKind; cause: unknown } | null;
  resultRevision: number;
  downloaded: boolean;
  status: ArtifactSafetyStatus;
};

// One entry owns the request, so unmounting a reader does not lose a successful
// response or permit another reader to start the same operation in parallel.
export class ArtifactEntry<T> {
  private snapshot: ArtifactSnapshot<T> = {
    record: null, loaded: false, isLoading: true, operation: null,
    failure: null, resultRevision: 0, downloaded: false, status: 'loading',
  };
  private listeners = new Set<() => void>();
  private inFlight: Promise<void> | null = null;
  private epoch = 0;
  private policy?: ArtifactPolicy;
  constructor(policy?: ArtifactPolicy) { this.policy = policy; }

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
    const epoch = ++this.epoch;
    this.inFlight = Promise.resolve().then(task).then(async (result) => {
      if (epoch !== this.epoch) return;
      if (result.record && this.policy) await this.policy.check(result.record);
      if (epoch !== this.epoch) return;
      if (result.record && this.policy?.current && !this.policy.current(result.record)) throw new Error('The map revision changed before artifact installation. Refresh the view.');
      this.publish({
        ...result,
        loaded: 'record' in result ? true : this.snapshot.loaded,
        resultRevision: this.snapshot.resultRevision + (kind === 'generate' || kind === 'reload' ? 1 : 0),
        ...('record' in result ? { status: !result.record ? 'missing' as const
          : (result.record as { inspectionOnly?: boolean }).inspectionOnly ? 'inspection' as const : 'current' as const } : {}),
      });
    }).catch(async (cause: unknown) => {
      if (epoch !== this.epoch) return;
      const recovered = this.policy?.recovered(cause);
      let recoveredVerified = false;
      if (recovered && this.policy) {
        try {
          await this.policy.check(recovered);
          if (this.policy.current && !this.policy.current(recovered)) throw new Error('The map revision changed before artifact recovery.');
          if (epoch === this.epoch) { recoveredVerified = true; this.publish({ record: recovered as T, loaded: true, status: 'current' }); }
        } catch { /* Failed verification never promotes recovered content. */ }
      }
      if (epoch !== this.epoch) return;
      this.publish({ failure: { kind, cause }, ...(this.policy && !recoveredVerified ? {
        status: this.policy.status(cause), ...(this.policy.inspection ? { record: null } : {}),
      } : {}) });
    }).finally(() => {
      if (epoch !== this.epoch) return;
      if (kind === 'generate') this.policy?.published();
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
    this.policy?.published();
    return this.execute('generate', async () => ({ record: await generate() }));
  }

  reload(load: () => Promise<T | null>): Promise<void> {
    if (this.snapshot.isLoading || this.inFlight) return Promise.resolve();
    return this.execute('reload', async () => ({ record: await load() }));
  }

  download(download: () => Promise<boolean>): Promise<void> {
    if (!this.snapshot.record || this.snapshot.isLoading || this.inFlight || this.policy && this.snapshot.status !== 'current') return Promise.resolve();
    return this.execute('download', async () => ({ downloaded: await download() }));
  }
  invalidate() {
    this.epoch++;
    this.inFlight = null;
    this.publish({ record: null, loaded: false, isLoading: true, operation: null, downloaded: false, status: 'loading', failure: null });
  }
  isEpoch(epoch: number) { return this.epoch === epoch; }
  getEpoch() { return this.epoch; }
  outputFailed(cause: unknown) {
    this.publish({ downloaded: false, failure: { kind: 'download', cause }, status: this.policy?.status(cause) ?? 'unavailable' });
  }
}

// Owned by a single mounted workspace, never by module globals or browser
// storage. A different project or source-system revision gets a fresh cache.
export class GeneratedArtifactCache {
  readonly mapId: string;
  readonly source?: object;
  readonly viewState = new Map<string, unknown>();
  private artifacts = new Map<ArtifactLoader<unknown>, unknown>();
  private tracked = new Map<string, ArtifactEntry<unknown>>();
  private active = true;
  readonly verify?: (record: unknown, inspection: boolean) => Promise<void>;
  private safety?: Omit<ArtifactPolicy, 'check' | 'published' | 'inspection'>;

  constructor(mapId: string, source?: object, safety?: {
    verify: (record: unknown, inspection: boolean) => Promise<void>;
    status: ArtifactPolicy['status']; recovered: ArtifactPolicy['recovered']; current: (record: unknown) => boolean;
  }) {
    this.mapId = mapId;
    this.source = source;
    this.verify = safety?.verify;
    this.safety = safety;
  }

  get<T>(load: ArtifactLoader<T>): ArtifactEntry<T> {
    let entry = this.artifacts.get(load) as ArtifactEntry<T> | undefined;
    if (!entry) {
      entry = new ArtifactEntry<T>();
      this.artifacts.set(load, entry);
    }
    return entry;
  }
  getTracked<T>(kind: string, inspection = false): ArtifactEntry<T> {
    const key = kind + (inspection ? ':inspection' : ':current');
    let entry = this.tracked.get(key);
    if (!entry) {
      if (!this.verify || !this.safety) throw new Error('Tracked artifact verification requires a workspace.');
      entry = new ArtifactEntry<unknown>({
        ...this.safety, inspection, current: (record) => this.isCurrentRecord(record), check: (record) => this.verifyRecord(record, inspection), published: () => this.invalidateDependencies(kind),
      });
      this.tracked.set(key, entry);
    }
    return entry as ArtifactEntry<T>;
  }
  invalidateDependencies(kind: string) {
    const affected = ['api_contract', 'relational_schema', 'document_schema', 'adrs'].includes(kind) ? ['readme']
      : kind === 'env_vars' ? ['deployment'] : [];
    for (const [key, entry] of this.tracked) if (affected.some((name) => key.startsWith(name + ':'))) entry.invalidate();
  }
  async verifyRecord(record: unknown, inspection = false) {
    if (!this.active || !this.verify) throw new Error('The artifact workspace changed. Refresh the current view.');
    await this.verify(record, inspection);
    if (!this.active) throw new Error('The artifact workspace changed. Refresh the current view.');
  }
  isCurrentRecord(record: unknown) { return this.active && this.safety?.current?.(record) === true; }
  retain() { this.active = true; }
  retire() { this.active = false; for (const entry of this.tracked.values()) entry.invalidate(); }
}
