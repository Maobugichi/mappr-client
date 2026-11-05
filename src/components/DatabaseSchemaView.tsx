'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { FileTextIcon, TableIcon } from '@phosphor-icons/react';
import type { MapprSystem } from '@/lib/api';
import { usePreservedViewState } from '@/lib/artifact-workspace';
import { RelationalSchemaView } from './RelationalSchemaView';
import { DocumentSchemaView } from './DocumentSchemaView';
import styles from './SchemaView.module.css';

type SchemaTarget = 'relational' | 'document';

const DOCUMENT_KEYWORDS = ['mongo', 'firestore', 'dynamo', 'couchbase', 'cassandra'];

// Best-effort only — techStack.choice is free text (see
// backend/src/schema/mapprSystem.ts's TechStackItemSchema), so this is
// just a sensible starting view, not something either view relies on for
// correctness. Nothing generates until the user clicks Generate.
function guessTarget(techStack: MapprSystem['techStack']): SchemaTarget {
  const choices = techStack.map((item) => item.choice.toLowerCase());
  const looksDocument = choices.some((choice) => DOCUMENT_KEYWORDS.some((kw) => choice.includes(kw)));
  return looksDocument ? 'document' : 'relational';
}

function DatabaseSchemaContent({
  mapId,
  productName,
  techStack,
}: {
  mapId: string;
  productName: string;
  techStack: MapprSystem['techStack'];
}) {
  const [target, setTarget] = usePreservedViewState<SchemaTarget>('schema:mode', () => guessTarget(techStack));
  const [availability, setAvailability] = useState<Record<SchemaTarget, boolean | null>>({ relational: null, document: null });
  const rootRef = useRef<HTMLDivElement>(null);
  const restoreModeFocus = useRef(false);
  const reportRelational = useCallback((available: boolean | null) => {
    setAvailability((current) => current.relational === available ? current : { ...current, relational: available });
  }, []);
  const reportDocument = useCallback((available: boolean | null) => {
    setAvailability((current) => current.document === available ? current : { ...current, document: available });
  }, []);
  const choose = (option: SchemaTarget) => {
    if (target === option) return;
    restoreModeFocus.current = true;
    setTarget(option);
  };
  useLayoutEffect(() => {
    if (!restoreModeFocus.current) return;
    restoreModeFocus.current = false;
    const active = rootRef.current?.querySelector<HTMLElement>('[data-schema-mode-view="' + target + '"]');
    const destination = active?.querySelector<HTMLElement>('[data-schema-mode="' + target + '"]') ?? active?.querySelector<HTMLElement>('h2');
    destination?.focus({ preventScroll: true });
  }, [target]);
  const modes = (['relational', 'document'] as const).filter((option) => availability[option] === true);
  const other = target === 'relational' ? 'document' : 'relational';
  const modeControls = modes.length > 0 ? <div role="group" aria-label="Available schema types" className={styles.modes}>
    {modes.map((option) => <button key={option} type="button" data-schema-mode={option}
      onClick={() => choose(option)} aria-pressed={target === option}
      aria-label={'View ' + option + ' schema'} title={option === 'relational' ? 'Relational schema' : 'Document schema'}
      className={styles.modeButton}>
      {option === 'relational' ? <TableIcon size={18} aria-hidden="true" /> : <FileTextIcon size={18} aria-hidden="true" />}
    </button>)}
  </div> : null;

  return (
    <div ref={rootRef} className={styles.schemaRoot}>
      {/* Each existing controller loads its saved record once. Both remain
          mounted so mode availability is factual and switching retains state. */}
      <div data-schema-mode-view="relational" hidden={target !== 'relational'}>
        <RelationalSchemaView mapId={mapId} productName={productName}
          modeControls={modeControls} onAvailabilityChange={reportRelational} />
      </div>
      <div data-schema-mode-view="document" hidden={target !== 'document'}>
        <DocumentSchemaView mapId={mapId} productName={productName}
          modeControls={modeControls} onAvailabilityChange={reportDocument} />
      </div>
      {availability[other] === false && <button type="button" className={styles.setupMode}
        onClick={() => choose(other)}>Set up {other} schema</button>}
    </div>
  );
}

export function DatabaseSchemaView(props: {
  mapId: string;
  productName: string;
  techStack: MapprSystem['techStack'];
}) {
  return <DatabaseSchemaContent key={props.mapId} {...props} />;
}
