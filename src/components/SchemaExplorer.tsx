'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { ColumnReference, DocumentCollection, DocumentField, RelationalColumn, RelationalTable } from '@/lib/api';
import styles from './SchemaView.module.css';

type SchemaItem = RelationalTable | DocumentCollection;
type Relationship = { from: string; to: string; field?: string };
type SchemaLink = {
  source: SchemaItem;
  field: RelationalColumn | DocumentField;
  target: SchemaItem | undefined;
  targetLabel: string;
  targetField?: string;
  kind?: NonNullable<DocumentField['relation']>['kind'];
};
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

function suppliedDefaults(column: RelationalColumn): [string, unknown][] {
  return Object.entries(column).filter(([key, value]) =>
    (key === 'default' || key === 'defaultValue') && value !== undefined);
}

function schemaLinks(items: readonly SchemaItem[]): SchemaLink[] {
  const links: SchemaLink[] = [];
  for (const source of items) {
    if ('columns' in source) {
      for (const field of source.columns) {
        if (!field.references) continue;
        const reference = field.references;
        const target = uniqueMatch(items, (item) => 'tableName' in item && item.tableName === reference.table);
        const targetField = target && 'columns' in target
          ? uniqueMatch(target.columns, (column) => column.name === reference.column)?.name : undefined;
        links.push({ source, field, target, targetField, targetLabel: reference.table + '.' + reference.column });
      }
    } else {
      for (const field of source.fields) {
        const relation = field.relation;
        if (!relation) continue;
        const target = uniqueMatch(items, (item) => 'collectionName' in item && item.entityId === relation.targetEntityId);
        links.push({ source, field, target, targetLabel: target ? nameOf(target) : relation.targetEntityId, kind: relation.kind });
      }
    }
  }
  return links;
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
  const navigatorRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
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
  const workspaceId = explorerId + '-workspace';
  const relationshipId = explorerId + '-relationship';
  const links = useMemo(() => schemaLinks(items), [items]);
  const outgoing = links.filter((link) => link.source === selected);
  const incoming = links.filter((link) => link.target === selected);
  const hasDefaults = selected && 'columns' in selected && selected.columns.some((column) => suppliedDefaults(column).length > 0);

  useLayoutEffect(() => {
    const navigator = navigatorRef.current;
    if (!navigator) return;
    // Reveal the active table inside this horizontal scroller only. Selecting
    // tables never scrolls the page or creates a second vertical scroll area.
    const reveal = () => {
      const active = navigator.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      const viewport = navigator.getBoundingClientRect(), bounds = active.getBoundingClientRect();
      const shift = bounds.left < viewport.left + 4 ? bounds.left - viewport.left - 4
        : bounds.right > viewport.right - 4 ? bounds.right - viewport.right + 4 : 0;
      if (shift) navigator.scrollLeft += shift;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(navigator);
    return () => observer.disconnect();
  }, [items, selected]);

  useLayoutEffect(() => {
    if (!view.relationship) return;
    // Ordinary selection never scrolls. Following a real relationship focuses
    // its target, revealing it only if the target is outside the viewport.
    const frame = requestAnimationFrame(() => {
      const workspace = workspaceRef.current;
      const target = workspace?.querySelector<HTMLElement>('[data-referenced="true"] th')
        ?? workspace?.querySelector<HTMLElement>('h3');
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
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-schema-item]'));
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
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

  const relationshipRow = (link: SchemaLink, index: number, direction: 'outgoing' | 'incoming') => {
    const destination = direction === 'incoming' ? link.source : link.target;
    const from = nameOf(link.source) + '.' + link.field.name;
    const targetField = direction === 'incoming' ? link.field.name : link.targetField;
    return <li key={nameOf(link.source) + '-' + link.field.name + '-' + index}>
      {link.kind && <span className={styles.supporting}>{link.kind}</span>}
      {destination ? <button type="button" className={styles.referenceButton}
        aria-label={'Inspect ' + nameOf(destination) + ' through relationship ' + from + ' to ' + link.targetLabel}
        onClick={() => choose(destination, { from, to: link.targetLabel, field: targetField })}>
        {from} {'\u2192'} {link.targetLabel}
      </button> : <>
        <span className={styles.referenceText}>{from} {'\u2192'} {link.targetLabel}</span>
        <span className={styles.supporting}>Target {singular} unavailable or ambiguous in this schema.</span>
      </>}
    </li>;
  };

  return <div className={styles.explorer}>
    <nav className={styles.navigator} aria-label={plural}>
      <div ref={navigatorRef} className={styles.tableScroller}>
        <ul role="tablist" aria-label={plural} aria-orientation="horizontal" className={styles.tableList} onKeyDown={navigate}>
          {items.map((item, index) => <li role="presentation" key={item.entityId + '-' + nameOf(item) + '-' + index}>
            <button type="button" role="tab" data-schema-item={index} id={explorerId + '-table-' + index}
              aria-selected={item === selected} aria-controls={workspaceId} tabIndex={item === selected ? 0 : -1}
              className={styles.tableTab} onClick={() => choose(item)}>
              {nameOf(item)}
            </button>
          </li>)}
        </ul>
      </div>
    </nav>
    <section ref={workspaceRef} id={workspaceId} className={styles.tableWorkspace} role="tabpanel"
      aria-labelledby={selected ? explorerId + '-table-' + items.indexOf(selected) : undefined} tabIndex={0}>
      {selected && <div key={selected.entityId + '-' + nameOf(selected)} className={styles.selectedContent}>
        <header className={styles.definitionHeader}>
          <p className={styles.eyebrow}>{singular} definition</p>
          <h3 tabIndex={-1} className={styles.itemTitle}>{nameOf(selected)}</h3>
          <p className={styles.entityId}>{fieldsOf(selected).length} field{fieldsOf(selected).length === 1 ? '' : 's'} · Entity <code>{selected.entityId}</code></p>
          <Metadata source={selected} omit={'columns' in selected ? ['entityId', 'tableName', 'columns'] : ['entityId', 'collectionName', 'fields']} />
        </header>
        {view.relationship && <p id={relationshipId} role="status" className={styles.relationshipNotice}>
          <span>{view.relationship.from} → {view.relationship.to}</span>
          {view.relationship.field && <span className={styles.supporting}>Referenced field highlighted below.</span>}
        </p>}
        {fieldsOf(selected).length === 0 ? <p className={styles.empty}>No fields were generated for this {singular}.</p> : (
          <table role="table" className={styles.fieldTable} data-mode={mode}>
            <caption className="sr-only">Generated fields in {nameOf(selected)}</caption>
            <thead role="rowgroup"><tr role="row">
              <th role="columnheader" scope="col">{'columns' in selected ? 'Column' : 'Field'}</th>
              <th role="columnheader" scope="col">Data type</th>
              {'columns' in selected ? <>
                <th role="columnheader" scope="col">Constraints</th>
                <th role="columnheader" scope="col">Nullability</th>
                {hasDefaults && <th role="columnheader" scope="col">Default</th>}
                <th role="columnheader" scope="col">References</th>
              </> : <th role="columnheader" scope="col">Definition</th>}
            </tr></thead>
            <tbody role="rowgroup">
              {'columns' in selected ? selected.columns.map((column, index) => {
                const unique = (column as RelationalColumn & { unique?: unknown }).unique;
                const defaults = suppliedDefaults(column);
                return <tr role="row" key={column.name + '-' + index} data-referenced={view.relationship?.field === column.name}>
                <th role="rowheader" scope="row" tabIndex={-1} aria-describedby={view.relationship?.field === column.name ? relationshipId : undefined}>
                  <span className={styles.cellLabel} aria-hidden="true">Column</span><code>{column.name}</code>
                </th>
                <td role="cell"><span className={styles.cellLabel} aria-hidden="true">Data type</span>
                  <code className={styles.dataType}>{column.type}</code><EnumValues values={column.enumValues} />
                </td>
                <td role="cell"><span className={styles.cellLabel} aria-hidden="true">Constraints</span><div className={styles.definition}>
                  {column.primaryKey && <span className={styles.primaryKey}>Primary key</span>}
                  {column.references && <span className={styles.foreignKey}>Foreign key</span>}
                  {typeof unique === 'boolean' && <span>{unique ? 'Unique' : 'Not unique'}</span>}
                  <Metadata source={column} omit={['name', 'type', 'primaryKey', 'nullable', 'enumValues', 'references', 'default', 'defaultValue', ...(typeof unique === 'boolean' ? ['unique'] : [])]} />
                </div></td>
                <td role="cell"><span className={styles.cellLabel} aria-hidden="true">Nullability</span>
                  {typeof column.nullable === 'boolean' ? column.nullable ? 'Nullable' : 'Not null' : <span className={styles.supporting}>Not specified</span>}
                </td>
                {hasDefaults && <td role="cell"><span className={styles.cellLabel} aria-hidden="true">Default</span>
                  {defaults.length > 0 ? <dl className={styles.defaultValues}>
                    {defaults.map(([key, value]) => <div key={key}>
                      <dt className={defaults.length === 1 ? 'sr-only' : styles.supporting}>{key}</dt>
                      <dd><code>{formatValue(value)}</code></dd>
                    </div>)}
                  </dl> : <span className={styles.supporting}>Not specified</span>}
                </td>}
                <td role="cell"><span className={styles.cellLabel} aria-hidden="true">References</span>
                  {column.references ? foreignKey(selected, column, column.references) : <span className={styles.supporting}>None</span>}
                </td>
              </tr>; }) : selected.fields.map((field, index) => <tr role="row" key={field.name + '-' + index} data-referenced={view.relationship?.field === field.name}>
                <th role="rowheader" scope="row" tabIndex={-1} aria-describedby={view.relationship?.field === field.name ? relationshipId : undefined}><span className={styles.cellLabel} aria-hidden="true">Field</span><code>{field.name === 'id' ? '_id' : field.name}</code>
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
        <section className={styles.relationships} aria-labelledby={explorerId + '-relationships-heading'}>
          <h4 id={explorerId + '-relationships-heading'}>Relationships</h4>
          {outgoing.length === 0 && incoming.length === 0 ? <p className={styles.empty}>
            {mode === 'relational' ? 'No foreign-key relationships are defined for this table.' : 'No relationships are defined for this collection.'}
          </p> : <div className={styles.relationshipGroups}>
            <div><h5>Outgoing</h5>{outgoing.length > 0
              ? <ul>{outgoing.map((link, index) => relationshipRow(link, index, 'outgoing'))}</ul>
              : <p className={styles.supporting}>None defined.</p>}</div>
            <div><h5>Incoming</h5>{incoming.length > 0
              ? <ul>{incoming.map((link, index) => relationshipRow(link, index, 'incoming'))}</ul>
              : <p className={styles.supporting}>None defined.</p>}</div>
          </div>}
        </section>
      </div>}
    </section>
    <p className="sr-only" role="status" aria-atomic="true">{selected ? nameOf(selected) + ' selected. ' + fieldsOf(selected).length + ' fields.' : ''}</p>
  </div>;
}
