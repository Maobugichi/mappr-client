'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CaretDownIcon, CodeIcon } from '@phosphor-icons/react';
import type { ApiContract, ApiEndpoint, HttpMethod } from '@/lib/api';
import { getApiContract, runApiContract } from '@/lib/api';
import { buildOpenApiDocument } from '@/lib/openapi-export';
import { useGeneratedArtifact } from '@/lib/use-generated-artifact';
import { usePreservedViewState } from '@/lib/artifact-workspace';
import { ArtifactActionButton, ArtifactActions } from './ArtifactActions';
import { MotionDisclosure } from './MotionDisclosure';
import styles from './ApiContractView.module.css';

type Field = { name: string; type?: string; required?: boolean; description?: string };
type EndpointIdentity = Pick<ApiEndpoint, 'id' | 'method' | 'path'>;

function property(value: object, key: string): unknown {
  return (value as Record<string, unknown>)[key];
}
function textProperty(value: object, key: string): string | undefined {
  const candidate = property(value, key);
  return typeof candidate === 'string' ? candidate : undefined;
}
function extraData(value: object, known: readonly string[]): Record<string, unknown> | undefined {
  const extra = Object.fromEntries(Object.entries(value).filter(([key]) => !known.includes(key)));
  return Object.keys(extra).length ? extra : undefined;
}
function tagsFor(endpoint: ApiEndpoint): string[] {
  const tags = property(endpoint, 'tags');
  return Array.isArray(tags) && tags.every((tag) => typeof tag === 'string') ? tags : [];
}
function resourceGroup(endpoint: ApiEndpoint): string {
  const declared = textProperty(endpoint, 'resourceGroup') ?? textProperty(endpoint, 'group') ?? tagsFor(endpoint)[0];
  if (declared) return declared;
  const segments = endpoint.path.split('/').filter(Boolean);
  const resource = segments.findIndex((segment) => segment.toLowerCase() !== 'api'
    && !/^v\d+(?:\.\d+)*$/i.test(segment) && !/^(?:\{.*\}|:.*)$/.test(segment));
  return '/' + segments.slice(0, resource < 0 ? 1 : resource + 1).join('/');
}
function pathFields(endpoint: ApiEndpoint): Field[] {
  const documented = property(endpoint, 'pathParams') ?? property(endpoint, 'pathParameters');
  const fields: Field[] = Array.isArray(documented)
    ? documented.filter((field): field is Field => Boolean(field && typeof field === 'object' && typeof field.name === 'string'))
    : [];
  const names = [...endpoint.path.matchAll(/\{([^{}]+)\}|(?:^|\/):([A-Za-z_][\w-]*)/g)]
    .map((match) => match[1] ?? match[2]);
  return [...fields, ...[...new Set(names)].filter((name) => !fields.some((field) => field.name === name)).map((name) => ({ name }))];
}
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function MethodBadge({ method }: { method: HttpMethod }) {
  return <span className={styles.method} data-method={method}>{method}</span>;
}
function ProvidedData({ label, value }: { label: string; value: unknown }) {
  const disclosureId = useId();
  const [isOpen, setIsOpen] = useState(false);
  if (value === undefined) return null;
  return (
    <div className={styles.providedData}>
      <button type="button" className={styles.disclosureButton} aria-expanded={isOpen}
        aria-controls={disclosureId} onClick={() => setIsOpen((open) => !open)}>
        {label}<CaretDownIcon size={12} aria-hidden="true" className={styles.chevron} data-open={isOpen} />
      </button>
      <MotionDisclosure isOpen={isOpen} id={disclosureId}>
        <pre className={styles.schema}><code>{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</code></pre>
      </MotionDisclosure>
    </div>
  );
}
function FieldRows({ fields, empty }: { fields: readonly Field[]; empty: string }) {
  if (fields.length === 0) return <p className={styles.emptyDetail}>{empty}</p>;
  return (
    <dl className={styles.fields}>
      {fields.map((field, index) => (
        <div key={field.name + '-' + index} className={styles.field}>
          <dt className={styles.fieldName}>{field.name}</dt>
          <dd className={styles.fieldMeta}>
            {typeof field.type === 'string' ? <code>{field.type}</code> : <span className={styles.unspecified}>Type not specified</span>}
            {typeof field.required === 'boolean' && <span className={styles.requirement} data-required={field.required}>{field.required ? 'Required' : 'Optional'}</span>}
          </dd>
          {typeof field.description === 'string' && <dd className={styles.fieldDescription}>{field.description}</dd>}
          {extraData(field, ['name', 'type', 'required', 'description']) && <dd className={styles.fieldDescription}>
            <ProvidedData label="Provided field details" value={extraData(field, ['name', 'type', 'required', 'description'])} />
          </dd>}
        </div>
      ))}
    </dl>
  );
}
function EndpointDetails({ endpoint, headingId }: { endpoint: ApiEndpoint; headingId: string }) {
  const description = textProperty(endpoint, 'description');
  const pathParameters = pathFields(endpoint);
  const tags = tagsFor(endpoint);
  const additional = extraData(endpoint, [
    'id', 'method', 'path', 'summary', 'access', 'featureIds', 'entityIds',
    'queryParams', 'bodyFields', 'successStatus', 'responseFields', 'errors',
    ...(description !== undefined ? ['description'] : []),
    ...(tags.length > 0 ? ['tags'] : []),
    'requestSchema', 'responseSchema',
  ]);
  return (
    <div className={styles.operation}>
      <header className={styles.operationHeader}>
        <h3 id={headingId} tabIndex={-1} className={styles.summary}>{endpoint.summary?.trim() || endpoint.id || 'Operation details'}</h3>
        {description !== undefined && <p className={styles.description}>{description}</p>}
        <dl className={styles.operationMeta}>
          <div><dt>Authentication</dt><dd>{endpoint.access === 'public' ? 'Public' : endpoint.access === 'authenticated' ? 'Authenticated' : endpoint.access}</dd></div>
          <div><dt>Operation ID</dt><dd><code>{endpoint.id}</code></dd></div>
        </dl>
        {endpoint.access === 'authenticated' && <p className={styles.note}>Authentication is required. Credential details are not specified by the access-level field.</p>}
        {(endpoint.featureIds ?? []).length > 0 && <div className={styles.references}>
          <p className={styles.eyebrow}>Associated features</p>
          <ul>{endpoint.featureIds.map((id, index) => <li key={id + '-' + index}>{id}</li>)}</ul>
        </div>}
        {(endpoint.entityIds ?? []).length > 0 && <div className={styles.references}>
          <p className={styles.eyebrow}>Associated entities</p>
          <ul>{endpoint.entityIds.map((id, index) => <li key={id + '-' + index}>{id}</li>)}</ul>
        </div>}
        {tags.length > 0 && <div className={styles.references}>
          <p className={styles.eyebrow}>Tags</p><ul>{tags.map((tag, index) => <li key={tag + '-' + index}>{tag}</li>)}</ul>
        </div>}
      </header>

      <section className={styles.detailSection} aria-label="Path parameters">
        <h4>Path parameters</h4>
        {pathParameters.length > 0 && <p className={styles.note}>Placeholder names come from the path. Types and required flags appear only when documented.</p>}
        <FieldRows fields={pathParameters} empty="No path parameters are declared in this path." />
      </section>
      <section className={styles.detailSection} aria-label="Query parameters">
        <h4>Query parameters</h4>
        <FieldRows fields={endpoint.queryParams ?? []} empty="No query parameters were documented." />
      </section>
      <section className={styles.detailSection} aria-label="Request body">
        <h4>Request body</h4>
        <FieldRows fields={endpoint.bodyFields ?? []} empty="No request body fields were documented." />
        <ProvidedData label="Provided request schema" value={property(endpoint, 'requestSchema')} />
      </section>
      <section className={styles.detailSection} aria-label="Success response">
        <h4>Success response <span className={styles.responseStatus}>{endpoint.successStatus}</span></h4>
        <FieldRows fields={endpoint.responseFields ?? []} empty="No response fields were documented." />
        <ProvidedData label="Provided response schema" value={property(endpoint, 'responseSchema')} />
      </section>
      <section className={styles.detailSection} aria-label="Documented errors">
        <h4>Documented errors</h4>
        {(endpoint.errors ?? []).length === 0 ? <p className={styles.emptyDetail}>No error responses were documented.</p> : (
          <dl className={styles.errors}>
            {endpoint.errors.map((error, index) => <div key={error.status + '-' + index}>
              <dt>{error.status}</dt><dd>{error.description}
                <ProvidedData label="Provided error details" value={extraData(error, ['status', 'description'])} />
              </dd>
            </div>)}
          </dl>
        )}
      </section>
      <ProvidedData label="Additional documented data" value={additional} />
    </div>
  );
}

function EndpointExplorer({ contract }: { contract: ApiContract }) {
  const explorerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const directoryRef = useRef<HTMLElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const revealFrameRef = useRef<number | null>(null);
  const [view, setView] = usePreservedViewState<{ contract: ApiContract; endpoint: EndpointIdentity | null; expanded: string | null }>('api:endpoint', () => ({
    contract, endpoint: contract.endpoints[0] ?? null, expanded: null,
  }));
  const selected = contract.endpoints.find((endpoint) => endpoint.id === view.endpoint?.id)
    ?? contract.endpoints.find((endpoint) => endpoint.method === view.endpoint?.method && endpoint.path === view.endpoint?.path)
    ?? contract.endpoints[0];
  if (view.contract !== contract) {
    // Reconcile against the actual replacement record, not a generation counter.
    // This keeps ID or method/path matches and commits a real fallback selection.
    setView({ contract, endpoint: selected ?? null, expanded: view.expanded !== null ? selected?.id ?? null : null });
  }
  const groups = useMemo(() => {
    const result = new Map<string, { endpoint: ApiEndpoint; index: number }[]>();
    contract.endpoints.forEach((endpoint, index) => {
      const key = resourceGroup(endpoint);
      const group = result.get(key);
      if (group) group.push({ endpoint, index });
      else result.set(key, [{ endpoint, index }]);
    });
    return Array.from(result);
  }, [contract.endpoints]);

  useLayoutEffect(() => {
    const directory = directoryRef.current;
    if (!directory) return;
    const measure = () => {
      const top = parseFloat(getComputedStyle(directory).getPropertyValue('--api-sticky-top')) || 24;
      directory.dataset.fitsViewport = String(directory.getBoundingClientRect().height <= window.innerHeight - top - 16);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(directory);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  useEffect(() => () => {
    if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
  }, []);

  const choose = (endpoint: ApiEndpoint, mobile = false, reveal = true) => {
    setView({ contract, endpoint, expanded: mobile && view.expanded === endpoint.id ? null : endpoint.id });
    if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
    if (!reveal || mobile || !rootRef.current || rootRef.current.clientWidth < 1000) return;
    revealFrameRef.current = requestAnimationFrame(() => {
      const heading = inspectorRef.current?.querySelector<HTMLElement>('h3');
      const rect = heading?.getBoundingClientRect();
      if (!heading || !rect || (rect.top >= 24 && rect.bottom <= window.innerHeight - 16)) return;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  };
  const navigate = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-endpoint]')).filter((button) => button.offsetParent !== null);
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : Math.max(0, Math.min(buttons.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
    if (next === current) return;
    const endpoint = contract.endpoints[Number(buttons[next].dataset.endpoint)];
    choose(endpoint, buttons[next].hasAttribute('aria-expanded'), false);
    buttons[next].focus({ preventScroll: true });
    buttons[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <div ref={rootRef} className={styles.workspace}>
      <nav ref={directoryRef} className={styles.directory} aria-label="API endpoint directory" onKeyDown={navigate}>
        <h3 className={styles.directoryHeading}>Endpoints</h3>
        {groups.map(([group, entries], groupIndex) => (
          <section key={group} className={styles.resourceGroup} aria-labelledby={explorerId + '-group-' + groupIndex}>
            <h4 id={explorerId + '-group-' + groupIndex}>{group}</h4>
            <ul className={styles.endpointList}>
              {entries.map(({ endpoint, index }) => {
                const isSelected = selected === endpoint;
                const isExpanded = isSelected && view.expanded === endpoint.id;
                return (
                  <li key={endpoint.id + '-' + index} data-selected={isSelected} data-expanded={isExpanded}>
                    <button type="button" data-endpoint={index} className={styles.desktopRow}
                      aria-pressed={isSelected} aria-controls={explorerId + '-inspector'} onClick={() => choose(endpoint)}
                      title={endpoint.summary}>
                      <MethodBadge method={endpoint.method} /><code>{endpoint.path}</code>
                    </button>
                    <button type="button" data-endpoint={index} className={styles.mobileRow}
                      aria-expanded={isExpanded} aria-controls={explorerId + '-inline-' + index}
                      onClick={() => choose(endpoint, true)}>
                      <MethodBadge method={endpoint.method} /><code>{endpoint.path}</code>
                      <CaretDownIcon size={12} aria-hidden="true" className={styles.chevron} data-open={isExpanded} />
                    </button>
                    <div className={styles.inlineDetails}>
                      <MotionDisclosure isOpen={isExpanded} id={explorerId + '-inline-' + index}>
                        {isSelected && <EndpointDetails endpoint={endpoint} headingId={explorerId + '-inline-heading-' + index} />}
                      </MotionDisclosure>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
      <section ref={inspectorRef} id={explorerId + '-inspector'} className={styles.inspector} aria-label="Selected endpoint details">
        {selected && <div key={selected.id + '-' + selected.method + '-' + selected.path} className={styles.selectedContent}>
          <EndpointDetails endpoint={selected} headingId={explorerId + '-operation-heading'} />
        </div>}
      </section>
      <p className="sr-only" role="status" aria-atomic="true">{selected ? selected.method + ' ' + selected.path + ' selected.' : ''}</p>
    </div>
  );
}

function ApiContractContent({ mapId, productName }: { mapId: string; productName: string }) {
  const generateTriggerRef = useRef<HTMLButtonElement>(null);
  const [lastAction, setLastAction] = usePreservedViewState<'load' | 'generate' | 'download'>('ApiContractView:last-action', 'load');
  const {
    record: contract, isLoading, isRunning, isReloading, isWorking, error,
    resultRevision, downloaded, runGeneration, runDownload, runReload,
  } = useGeneratedArtifact({
    mapId, load: getApiContract, generate: runApiContract,
    loadError: 'Could not load the saved API contract. Use Retry loading to check again.',
    generationError: 'Could not generate the API contract. Your displayed contract is unchanged.',
    exportError: 'Could not prepare the OpenAPI export. Use Retry export to try again.',
  });
  const handleRun = (trigger: HTMLButtonElement) => {
    if (lastAction === 'load' && error) return runReload(trigger);
    setLastAction('generate');
    return runGeneration(trigger);
  };
  const handleDownload = (trigger: HTMLButtonElement) => {
    if (!contract) return;
    setLastAction('download');
    // Serialization and browser download preparation are local synchronous work.
    // Keep the shared operation lock and error handling, without a fake loader.
    return runDownload(trigger, async () => ({
      filename: (slugify(productName) || 'mappr-export') + '-openapi-v' + contract.version + '.json',
      content: JSON.stringify(buildOpenApiDocument(contract, productName), null, 2),
      mimeType: 'application/json',
    }));
  };
  const pending = isLoading || isRunning || isReloading;

  return (
    <section className={styles.apiContract} aria-label="API Explorer">
      <header className={styles.header}>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}>API contract</p>
          <h2 className={styles.title}>API Explorer</h2>
          <p role="status" aria-atomic="true" className={styles.version}>
            {contract ? 'Displayed contract v' + contract.version + ' · ' + contract.endpoints.length + ' endpoint' + (contract.endpoints.length === 1 ? '' : 's')
              : isLoading ? 'Loading saved contract.' : 'No contract is currently displayed.'}
          </p>
        </div>
        <ArtifactActions>
          {contract && <ArtifactActionButton action="export" title="Export OpenAPI JSON" data-contract-export variant="secondary"
            onClick={(event) => void handleDownload(event.currentTarget)}
            state={error && lastAction === 'download' ? 'error' : downloaded ? 'success' : 'idle'}
            disabled={isWorking || isLoading} idleLabel="OpenAPI JSON" pendingLabel="Preparing OpenAPI JSON"
            successLabel="Download again" errorLabel="Retry export"  />}
          <ArtifactActionButton action="generate" title={contract ? 'Regenerate API contract' : 'Generate API contract'} regenerate={Boolean(contract)} ref={generateTriggerRef} data-contract-action
            onClick={(event) => void handleRun(event.currentTarget)} disabled={isWorking}
            state={pending ? 'pending' : error && lastAction !== 'download' ? 'error' : resultRevision > 0 && contract ? 'success' : 'idle'}
            idleLabel={contract ? 'Regenerate' : 'Generate contract'}
            pendingLabel={isLoading || isReloading ? 'Loading saved API contract' : contract ? 'Regenerating API contract' : 'Generating API contract'}
            successLabel={contract ? 'Regenerate' : 'Generate contract'}
            errorLabel={lastAction === 'load' ? 'Retry loading' : 'Retry generation'}
            icon={<CodeIcon size={14} weight="bold" />} />
        </ArtifactActions>
      </header>
      <MotionDisclosure isOpen={Boolean(error)}>
        <p role="alert" className={styles.error}>{error}</p>
      </MotionDisclosure>
      {contract ? contract.endpoints.length > 0 ? <EndpointExplorer contract={contract} /> : (
        <p className={styles.empty}>No endpoints were generated. Regenerate to try again.</p>
      ) : <p className={styles.empty}>Generated endpoints, request fields and responses will appear here.</p>}
      <p className="sr-only" role="status" aria-atomic="true">
        {isRunning ? 'Generating the API contract. ' + (contract ? 'The displayed v' + contract.version + ' remains available.' : '')
          : downloaded ? 'OpenAPI JSON download prepared.' : ''}
      </p>
    </section>
  );
}

export function ApiContractView(props: { mapId: string; productName: string }) {
  // Map changes invalidate the shared lifecycle and all local endpoint selection.
  return <ApiContractContent key={props.mapId} {...props} />;
}
