'use client';

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ColumnReference, DocumentCollection, DocumentField, RelationalColumn, RelationalTable } from '@/lib/api';
import styles from './SchemaView.module.css';

type SchemaItem = RelationalTable | DocumentCollection;
type Relationship = { from: string; to: string; field?: string };
type ExplorerProps =
  | { mode: 'relational'; items: RelationalTable[] }
  | { mode: 'document'; items: DocumentCollection[] };

function nameOf(item: SchemaItem): string {
  return 'tableName' in item ? item.tableName : item.collectionName;
}
function fieldsOf(item: SchemaItem): readonly (RelationalColumn | DocumentField)[] {
  return 'columns' in item ? item.columns : item.fields;
}
function uniqueMatch<T>(items: readonly T[], predicate: (item: T) => boolean): T | undefined {
  const matches = items.filter(predicate);
  return matches.length === 1 ? matches[0] : undefined;
}
function retainSelection(items: readonly SchemaItem[], previous: SchemaItem | undefined): SchemaItem | undefined {
  if (!previous) return items[0];
  return uniqueMatch(items, (item) => item.entityId === previous.entityId && nameOf(item) === nameOf(previous))
    ?? uniqueMatch(items, (item) => item.entityId === previous.entityId)
    ?? uniqueMatch(items, (item) => nameOf(item) === nameOf(previous))
    ?? items[0];
}
function formatValue(value: unknown): string {
  return typeof value === 'string' ? value || '""' : JSON.stringify(value, null, 2) ?? String(value);
}

// Render only metadata actually supplied by the generated record, including
// additional constraints such as unique/default when present at runtime.
function Metadata({ source, omit }: { source: object; omit: readonly string[] }) {
  const entries = Object.entries(source).filter(([key]) => !omit.includes(key));
  if (!entries.length) return null;
  return <dl className={styles.metadata}>
    {entries.map(([key, value]) => <div key={key}>
      <dt>{key}</dt><dd><code>{formatValue(value)}</code></dd>
    </div>)}
  </dl>;
}
function EnumValues({ values }: { values: string[] | null }) {
  if (values === null || values === undefined) return null;
  return <div className={styles.enumValues}>
    <span className={styles.supporting}>Enum values</span>
    {values.length ? values.map((value, index) => <code key={index}>{formatValue(value)}</code>) : <span>None supplied</span>}
  </div>;
}

export function SchemaExplorer({ mode, items: sourceItems }: ExplorerProps) {
  const items: readonly SchemaItem[] = sourceItems;
  const explorerId = useId();
  const directoryRef = useRef<HTMLElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const [view, setView] = useState<{ items: readonly SchemaItem[]; selected: SchemaItem | undefined; relationship: Relationship | null }>(() => ({
    items, selected: items[0], relationship: null,
  }));
  const selected = items === view.items ? view.selected : retainSelection(items, view.selected);
  if (view.items !== items) {
    // Keep the selected definition, but do not carry a relationship from an
    // older generated record into the replacement schema.
    setView({ items, selected, relationship: null });
  }
  const plural = mode === 'relational' ? 'Tables' : 'Collections';
  const singular = mode === 'relational' ? 'table' : 'collection';
  const inspectorId = explorerId + '-inspector';
  const relationshipId = explorerId + '-relationship';

  useLayoutEffect(() => {
    const directory = directoryRef.current;
    if (!directory) return;
    const measure = () => {
      const top = parseFloat(getComputedStyle(directory).getPropertyValue('--schema-sticky-top')) || 24;
      directory.dataset.fitsViewport = String(directory.getBoundingClientRect().height <= window.innerHeight - top - 16);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(directory);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  useLayoutEffect(() => {
    if (!view.relationship) return;
    // Ordinary selection never scrolls. Following a real relationship focuses
    // its target, revealing it only if the target is outside the viewport.
    const frame = requestAnimationFrame(() => {
      const inspector = inspectorRef.current;
      const target = inspector?.querySelector<HTMLElement>('[data-referenced="true"] th')
        ?? inspector?.querySelector<HTMLElement>('h3');
      if (!target) return;
      target.focus({ preventScroll: true });
      const rect = target.getBoundingClientRect();
      if (rect.top < 24 || rect.bottom > window.innerHeight - 16) {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [view.relationship]);

  const choose = (item: SchemaItem, relationship: Relationship | null = null) => setView({ items, selected: item, relationship });
  const navigate = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-schema-item]'));
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    if (next === index) return;
    choose(items[next]);
    buttons[next].focus({ preventScroll: true });
  };

  const foreignKey = (table: RelationalTable, column: RelationalColumn, reference: ColumnReference) => {
    const target = uniqueMatch(items, (item) => 'tableName' in item && item.tableName === reference.table);
    const targetField = target && 'columns' in target
      ? uniqueMatch(target.columns, (field) => field.name === reference.column) : undefined;
    const text = reference.table + '.' + reference.column;
    return <div className={styles.reference}>
      {target && targetField ? <button type="button" className={styles.referenceButton}
        aria-label={'Follow foreign key ' + table.tableName + '.' + column.name + ' to ' + text}
        onClick={() => choose(target, { from: table.tableName + '.' + column.name, to: text, field: targetField.name })}>
        <span aria-hidden="true">→ </span>{text}
      </button> : <><span className={styles.referenceText}>→ {text}</span><span className={styles.supporting}>Target unavailable or ambiguous in this schema.</span></>}
      <Metadata source={reference} omit={['table', 'column']} />
    </div>;
  };
  const documentRelation = (collection: DocumentCollection, field: DocumentField) => {
    if (!field.relation) return null;
    const relation = field.relation;
    const target = uniqueMatch(items, (item) => 'collectionName' in item && item.entityId === relation.targetEntityId);
    return <div className={styles.reference}>
      <span className={styles.supporting}>{relation.kind}</span>
      {target ? <button type="button" className={styles.referenceButton}
        aria-label={'Inspect ' + relation.kind + ' relation from ' + collection.collectionName + '.' + field.name + ' to entity ' + relation.targetEntityId}
        onClick={() => choose(target, { from: collection.collectionName + '.' + field.name, to: nameOf(target) })}>
        <span aria-hidden="true">→ </span>{relation.targetEntityId}
      </button> : <><span className={styles.referenceText}>→ {relation.targetEntityId}</span><span className={styles.supporting}>Target collection unavailable or ambiguous in this schema.</span></>}
      <Metadata source={relation} omit={['kind', 'targetEntityId']} />
    </div>;
  };

  return <div className={styles.explorer}>
    <nav ref={directoryRef} className={styles.directory} aria-label={plural + ' directory'} onKeyDown={navigate}>
      <h3 className={styles.directoryHeading}>{plural}</h3>
      <ul className={styles.itemList}>
        {items.map((item, index) => <li key={item.entityId + '-' + nameOf(item) + '-' + index}>
          <button type="button" data-schema-item={index} aria-pressed={item === selected} aria-controls={inspectorId}
            className={styles.directoryRow} onClick={() => choose(item)}>
            <span>{nameOf(item)}</span><span className={styles.fieldCount}>{fieldsOf(item).length} fields</span>
          </button>
        </li>)}
      </ul>
    </nav>
    <div className={styles.compactSelector}>
      <label htmlFor={explorerId + '-select'}>{plural}</label>
      <select id={explorerId + '-select'} aria-controls={inspectorId} value={selected ? items.indexOf(selected) : ''}
        onChange={(event) => choose(items[Number(event.target.value)])}>
        {items.map((item, index) => <option key={index} value={index}>{nameOf(item)} · {fieldsOf(item).length} fields</option>)}
      </select>
    </div>
    <section ref={inspectorRef} id={inspectorId} className={styles.inspector} aria-label={'Selected ' + singular + ' schema'}>
      {selected && <div key={selected.entityId + '-' + nameOf(selected)} className={styles.selectedContent}>
        <header className={styles.inspectorHeader}>
          <p className={styles.eyebrow}>{singular} definition</p>
          <h3 tabIndex={-1} className={styles.itemTitle}>{nameOf(selected)}</h3>
          <p className={styles.entityId}>Entity <code>{selected.entityId}</code></p>
          <Metadata source={selected} omit={'columns' in selected ? ['entityId', 'tableName', 'columns'] : ['entityId', 'collectionName', 'fields']} />
        </header>
        {view.relationship && <p id={relationshipId} role="status" className={styles.relationshipNotice}>
          <span>{view.relationship.from} → {view.relationship.to}</span>
          {view.relationship.field && <span className={styles.supporting}>Referenced field highlighted below.</span>}
        </p>}
        {fieldsOf(selected).length === 0 ? <p className={styles.empty}>No fields were generated for this {singular}.</p> : (
          <table role="table" className={styles.fieldTable}>
            <caption className="sr-only">Generated fields in {nameOf(selected)}</caption>
            <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Field</th><th role="columnheader" scope="col">Data type</th><th role="columnheader" scope="col">Definition</th></tr></thead>
            <tbody role="rowgroup">
              {'columns' in selected ? selected.columns.map((column, index) => <tr role="row" key={column.name + '-' + index} data-referenced={view.relationship?.field === column.name}>
                <th role="rowheader" scope="row" tabIndex={-1} aria-describedby={view.relationship?.field === column.name ? relationshipId : undefined}>
                  <span className={styles.cellLabel} aria-hidden="true">Field</span><code>{column.name}</code>
                </th>
                <td role="cell"><span className={styles.cellLabel} aria-hidden="true">Data type</span><code className={styles.dataType}>{column.type}</code></td>
                <td role="cell"><span className={styles.cellLabel} aria-hidden="true">Definition</span><div className={styles.definition}>
                  {column.primaryKey && <span className={styles.primaryKey}>Primary key</span>}
                  {typeof column.nullable === 'boolean' && <span>{column.nullable ? 'Nullable' : 'Not null'}</span>}
                  <EnumValues values={column.enumValues} />
                  {column.references && foreignKey(selected, column, column.references)}
                  <Metadata source={column} omit={['name', 'type', 'primaryKey', 'nullable', 'enumValues', 'references']} />
                </div></td>
              </tr>) : selected.fields.map((field, index) => <tr role="row" key={field.name + '-' + index}>
                <th role="rowheader" scope="row"><span className={styles.cellLabel} aria-hidden="true">Field</span><code>{field.name === 'id' ? '_id' : field.name}</code>
                  {field.name === 'id' && <span className={styles.supporting}>Generated field: id</span>}
                </th>
                <td role="cell"><span className={styles.cellLabel} aria-hidden="true">Data type</span><code className={styles.dataType}>{field.type}</code></td>
                <td role="cell"><span className={styles.cellLabel} aria-hidden="true">Definition</span><div className={styles.definition}>
                  {typeof field.required === 'boolean' && <span>{field.required ? 'Required' : 'Optional'}</span>}
                  <EnumValues values={field.enumValues} />
                  {documentRelation(selected, field)}
                  <Metadata source={field} omit={['name', 'type', 'required', 'enumValues', 'relation']} />
                </div></td>
              </tr>)}
            </tbody>
          </table>
        )}
      </div>}
    </section>
    <p className="sr-only" role="status" aria-atomic="true">{selected ? nameOf(selected) + ' selected. ' + fieldsOf(selected).length + ' fields.' : ''}</p>
  </div>;
}
