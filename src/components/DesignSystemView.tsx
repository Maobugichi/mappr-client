'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRightIcon, CheckIcon, CopyIcon, WarningIcon } from '@phosphor-icons/react';
import type { MapprSystem } from '@/lib/api';
import { colorIllustration, resolveDesignTokenValue, typographyDeclarations, type DesignToken } from '@/lib/design-token-preview';
import styles from './DesignSystemView.module.css';

const CATEGORIES = [
  { key: 'colors', label: 'Colors' },
  { key: 'typography', label: 'Typography' },
  { key: 'spacing', label: 'Spacing' },
  { key: 'components', label: 'Components' },
] as const;
type Category = typeof CATEGORIES[number]['key'];
type Entry = { id: string; name: string; value: string };
type Backdrop = 'light' | 'dark';

function TokenPreview({ category, entry, tokens, backdrop }: {
  category: Exclude<Category, 'components'>;
  entry: Entry;
  tokens: readonly DesignToken[];
  backdrop: Backdrop;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sampleRef = useRef<HTMLDivElement>(null);
  const illustration = colorIllustration(entry.name);

  useLayoutEffect(() => {
    const frame = frameRef.current, sample = sampleRef.current;
    if (!frame || !sample) return;
    sample.removeAttribute('style');
    let applied = 0, partial = false;
    const apply = (property: string, value: string) => {
      const resolved = resolveDesignTokenValue(value, tokens);
      if (resolved === null || !CSS.supports(property, resolved)) return false;
      sample.style.setProperty(property, resolved);
      applied++;
      return true;
    };
    if (category === 'colors') {
      apply(illustration === 'text' ? 'color' : illustration === 'border' ? 'border-color' : 'background-color', entry.value);
    } else if (category === 'spacing') {
      apply('gap', entry.value);
    } else {
      const declarations = typographyDeclarations(entry.name, entry.value);
      const alternatives = declarations.length === 3
        && declarations.map(([property]) => property).join(',') === 'font,font-size,font-family'
        && declarations.every(([, value]) => value === entry.value);
      for (const [property, value] of declarations) {
        if (apply(property, value) && alternatives) break;
      }
      partial = !alternatives && applied < declarations.length;
    }
    frame.dataset.supported = String(applied > 0);
    frame.dataset.partial = String(partial);
  }, [category, entry.name, entry.value, illustration, tokens]);

  return (
    <div ref={frameRef} className={styles.previewFrame} data-supported="pending" data-kind={category}>
      <div className={styles.sampleViewport} data-backdrop={backdrop}>
        {category === 'colors' ? (
          <div ref={sampleRef}
            className={illustration === 'text' ? styles.colorText : illustration === 'border' ? styles.colorBorder : styles.colorSurface}>
            {illustration === 'text' ? 'Aa — Product text' : illustration === 'border' ? 'Element outline' : null}
          </div>
        ) : category === 'typography' ? (
          <div ref={sampleRef} className={styles.typeSample}>
            Design made visible.<br />Aa Bb Cc 0123456789
          </div>
        ) : (
          <div ref={sampleRef} className={styles.spacingSample}>
            <span>Element A</span><span>Element B</span>
          </div>
        )}
      </div>
      <p className={styles.unavailable}>
        This value cannot be rendered as standalone CSS, or references an unavailable token. The original value is preserved below.
      </p>
      <p className={styles.partial}>Some settings could not be applied. The complete original value is preserved below.</p>
      <p className={styles.previewNote}>
        {category === 'colors'
          ? illustration === 'text' ? 'Illustrative text-color usage, inferred from the token name.'
            : illustration === 'border' ? 'Illustrative border-color usage, inferred from the token name.'
              : 'Actual color appearance. Its semantic identifier is the generated token name.'
          : category === 'typography'
            ? 'Recognized CSS settings are applied. Unspecified settings use neutral defaults; named fonts must be available locally.'
            : 'The token sets the real gap between these elements. Larger spacing values can be scrolled horizontally.'}
      </p>
    </div>
  );
}

export function DesignSystemView({ designSystem }: { designSystem: MapprSystem['designSystem'] }) {
  const workbenchId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const revealFrameRef = useRef<number | null>(null);
  const copyRequestRef = useRef(0);
  const copyPendingRef = useRef(false);
  const [category, setCategory] = useState<Category>(() => CATEGORIES.find(({ key }) => designSystem[key].length)?.key ?? 'colors');
  const [selection, setSelection] = useState<Record<Category, number>>({ colors: 0, typography: 0, spacing: 0, components: 0 });
  const [backdrop, setBackdrop] = useState<Backdrop>('light');
  const [isCopying, setIsCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<{ id: string; value: string; state: 'pending' | 'copied' | 'failed' } | null>(null);
  const entries = useMemo<Record<Category, Entry[]>>(() => ({
    colors: designSystem.colors.map((item, index) => ({ id: 'colors-' + index, name: item.token, value: item.value })),
    typography: designSystem.typography.map((item, index) => ({ id: 'typography-' + index, name: item.token, value: item.value })),
    spacing: designSystem.spacing.map((item, index) => ({ id: 'spacing-' + index, name: item.token, value: item.value })),
    components: designSystem.components.map((item, index) => ({ id: 'components-' + index, name: item.name, value: item.description })),
  }), [designSystem]);
  const items = entries[category];
  const selected = items[selection[category]] ?? items[0];
  const categoryLabel = CATEGORIES.find((item) => item.key === category)!.label;
  const currentCopy = selected && copyResult?.id === selected.id && copyResult.value === selected.value ? copyResult.state : null;

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const measure = () => {
      const top = parseFloat(getComputedStyle(preview).getPropertyValue('--workbench-sticky-top')) || 24;
      preview.dataset.fitsViewport = String(preview.getBoundingClientRect().height <= window.innerHeight - top - 16);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(preview);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => () => {
    copyRequestRef.current++;
    if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
  }, []);

  const choose = (index: number, reveal = true) => {
    copyRequestRef.current++;
    setCopyResult(null);
    setSelection((previous) => ({ ...previous, [category]: index }));
    if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
    if (!reveal || !rootRef.current || rootRef.current.clientWidth >= 1000) return;
    revealFrameRef.current = requestAnimationFrame(() => {
      const preview = previewRef.current, rect = preview?.getBoundingClientRect();
      if (!preview || !rect || (rect.top >= 24 && rect.bottom <= window.innerHeight - 16)) return;
      previewHeadingRef.current?.focus({ preventScroll: true });
      preview.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  };
  const changeCategory = (next: Category) => {
    copyRequestRef.current++;
    setCopyResult(null);
    if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
    setCategory(next);
  };
  const navigateTabs = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const current = tabs.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    changeCategory(CATEGORIES[next].key);
    tabs[next].focus();
  };
  const navigateTokens = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-design-token]'));
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : Math.max(0, Math.min(buttons.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
    choose(next, false);
    buttons[next].focus({ preventScroll: true });
    buttons[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const copyValue = async () => {
    if (!selected || copyPendingRef.current) return;
    const request = ++copyRequestRef.current;
    copyPendingRef.current = true;
    setIsCopying(true);
    setCopyResult({ id: selected.id, value: selected.value, state: 'pending' });
    try {
      await navigator.clipboard.writeText(selected.value);
      if (request === copyRequestRef.current) setCopyResult({ id: selected.id, value: selected.value, state: 'copied' });
    } catch {
      if (request === copyRequestRef.current) setCopyResult({ id: selected.id, value: selected.value, state: 'failed' });
    } finally {
      copyPendingRef.current = false;
      setIsCopying(false);
    }
  };

  return (
    <section ref={rootRef} className={styles.workbench} aria-labelledby={workbenchId + '-heading'}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Generated product</p>
        <h2 id={workbenchId + '-heading'} className={styles.title}>Design system workbench</h2>
        <p className={styles.hint}>Explore the product&rsquo;s tokens and specifications. Mappr&rsquo;s workspace theme stays separate.</p>
      </header>

      <div role="tablist" aria-label="Design system sections" className={styles.tabs} onKeyDown={navigateTabs}>
        {CATEGORIES.map(({ key, label }) => (
          <button key={key} type="button" role="tab" id={workbenchId + '-tab-' + key}
            aria-selected={category === key} aria-controls={workbenchId + '-panel-' + key}
            tabIndex={category === key ? 0 : -1} className={styles.tab} onClick={() => changeCategory(key)}>
            {label}<span aria-hidden="true">{entries[key].length}</span>
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        <div className={styles.library}>
          {CATEGORIES.map(({ key, label }) => (
            <div key={key} role="tabpanel" id={workbenchId + '-panel-' + key}
              aria-labelledby={workbenchId + '-tab-' + key} hidden={category !== key}
              tabIndex={0} onKeyDown={navigateTokens}>
              {category === key && <>
                <div className={styles.libraryHeading}>
                  <h3>{label}</h3><span>{key === 'components' ? 'Generated specifications' : 'Generated tokens'}</span>
                </div>
                {items.length === 0 ? <p className={styles.empty}>No {label.toLowerCase()} were generated for this product.</p> : (
                  <ul className={styles.tokenList}>
                    {items.map((entry, index) => (
                      <li key={entry.id}>
                        <button type="button" data-design-token={index} className={styles.tokenRow}
                          aria-pressed={selected?.id === entry.id} aria-controls={workbenchId + '-preview'}
                          onClick={() => choose(index)}>
                          {category === 'colors' && <span className={styles.swatch} aria-hidden="true"
                            style={{ backgroundColor: resolveDesignTokenValue(entry.value, designSystem.colors) ?? undefined }} />}
                          <span className={styles.rowCopy}>
                            <span className={styles.tokenName}>{entry.name}</span>
                            <span className={category === 'components' ? styles.componentSummary : styles.tokenValue}>{entry.value}</span>
                          </span>
                          <ArrowRightIcon size={14} className={styles.rowArrow} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>}
            </div>
          ))}
        </div>

        <aside ref={previewRef} id={workbenchId + '-preview'} className={styles.preview} aria-labelledby={workbenchId + '-preview-heading'}>
          <p className={styles.eyebrow}>{category === 'components' ? 'Component specification' : 'Product preview'}</p>
          <h3 ref={previewHeadingRef} tabIndex={-1} id={workbenchId + '-preview-heading'} className={styles.previewTitle}>
            {selected?.name ?? categoryLabel}
          </h3>
          {!selected ? <p className={styles.empty}>There is nothing to preview in this section yet.</p> : (
            <div key={selected.id} className={styles.previewContent}>
              {category !== 'components' ? <>
                <div className={styles.contextBar}>
                  <span>Neutral backdrop</span>
                  <div role="group" aria-label="Preview backdrop">
                    {(['light', 'dark'] as const).map((value) => (
                      <button key={value} type="button" aria-pressed={backdrop === value} onClick={() => setBackdrop(value)}>{value}</button>
                    ))}
                  </div>
                </div>
                <TokenPreview category={category} entry={selected} tokens={designSystem[category]} backdrop={backdrop} />
                <dl className={styles.metadata}>
                  <div><dt>{category === 'colors' ? 'Semantic token' : 'Token'}</dt><dd>{selected.name}</dd></div>
                  <div><dt>Generated value</dt><dd><code className={styles.rawValue}>{selected.value}</code></dd></div>
                </dl>
              </> : <>
                <p className={styles.specification}>{selected.value}</p>
                <p className={styles.previewNote}>Specification only. The generated data includes a description, not a component implementation or structured interaction definition.</p>
              </>}
              <div className={styles.copyBar}>
                <button type="button" className={styles.copyButton} onClick={() => void copyValue()} disabled={isCopying} aria-busy={isCopying}
                  aria-label={'Copy ' + (category === 'components' ? 'specification' : 'value') + ' for ' + selected.name}>
                  {currentCopy === 'copied' ? <CheckIcon size={14} aria-hidden="true" />
                    : currentCopy === 'failed' ? <WarningIcon size={14} aria-hidden="true" /> : <CopyIcon size={14} aria-hidden="true" />}
                  {currentCopy === 'copied' ? 'Copied' : category === 'components' ? 'Copy specification' : 'Copy value'}
                </button>
              </div>
              <p role="status" className={currentCopy === 'failed' ? styles.copyError : styles.copyStatus}>
                {currentCopy === 'failed' ? 'Could not access the clipboard. Select the original text above to copy it manually.'
                  : currentCopy === 'copied' ? 'Copied the original generated text.' : ''}
              </p>
            </div>
          )}
        </aside>
      </div>
      <p className="sr-only" role="status" aria-atomic="true">
        {selected ? categoryLabel + ': ' + selected.name + ' selected.' : categoryLabel + ': no generated entries.'}
      </p>
    </section>
  );
}
