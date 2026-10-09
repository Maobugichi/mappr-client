'use client';

import { useState } from 'react';
import type { MapprSystem } from '@/lib/api';
import { RelationalSchemaView } from './RelationalSchemaView';
import { DocumentSchemaView } from './DocumentSchemaView';

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

export function DatabaseSchemaView({
  mapId,
  productName,
  techStack,
}: {
  mapId: string;
  productName: string;
  techStack: MapprSystem['techStack'];
}) {
  const [target, setTarget] = useState<SchemaTarget>(() => guessTarget(techStack));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        {(['relational', 'document'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setTarget(option)}
            className={`rounded-full px-3 py-1.5 font-mono text-xs capitalize transition-colors ${
              target === option
                ? 'bg-signal text-canvas'
                : 'text-text-muted hover:bg-surface-raised hover:text-text'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {target === 'relational' ? (
        <RelationalSchemaView mapId={mapId} productName={productName} />
      ) : (
        <DocumentSchemaView mapId={mapId} productName={productName} />
      )}
    </div>
  );
}