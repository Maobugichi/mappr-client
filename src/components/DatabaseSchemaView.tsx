'use client';

import { useState } from 'react';
import type { MapprSystem } from '@/lib/api';
import { RelationalSchemaView } from './RelationalSchemaView';
import { DocumentSchemaView } from './DocumentSchemaView';
import styles from './SchemaView.module.css';

type SchemaTarget = 'relational' | 'document';

const DOCUMENT_KEYWORDS = ['mongo', 'firestore', 'dynamo', 'couchbase', 'cassandra'];

// Best-effort only — techStack.choice is free text (see
// backend/src/schema/mapprSystem.ts's TechStackItemSchema), so this is
// just a sensible starting tab, not something either view relies on for
// correctness. The user can always switch, and nothing generates until
// they click Generate on whichever side is showing.
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
  const [target, setTarget] = useState<SchemaTarget>(() => guessTarget(techStack));
  const [visited, setVisited] = useState<SchemaTarget[]>([target]);

  return (
    <div className={styles.schemaRoot}>
      <div role="group" aria-label="Schema type" className={styles.modes}>
        {(['relational', 'document'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setTarget(option);
              setVisited((current) => current.includes(option) ? current : [...current, option]);
            }}
            aria-pressed={target === option}
            className={styles.modeButton}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Load a mode on its first visit; retain its schema, selection and engine
          when hidden. Switching presentation never starts generation. */}
      {visited.includes('relational') && <div hidden={target !== 'relational'}>
        <RelationalSchemaView mapId={mapId} productName={productName} />
      </div>}
      {visited.includes('document') && <div hidden={target !== 'document'}>
        <DocumentSchemaView mapId={mapId} productName={productName} />
      </div>}
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
