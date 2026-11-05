'use client';

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CaretDownIcon, CheckIcon, DatabaseIcon } from '@phosphor-icons/react';
import { resolveTechnologyLogo } from '@/lib/technology-logo';
import styles from './SchemaView.module.css';

function EngineLogo({ name }: { name: string }) {
  const logo = resolveTechnologyLogo(name);
  return <span className={styles.engineLogo} aria-hidden="true" data-technology-logo={logo?.slug ?? 'generic'}>
    {logo ? <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" focusable="false">
      <path d={logo.path} />
    </svg> : <DatabaseIcon size={20} />}
  </span>;
}

export function SchemaEngineSelect<T extends string>({ value, options, onChange, disabled }: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const name = options.find((option) => option.value === value)?.label ?? value;
  const unavailable = Boolean(disabled || options.length === 0);
  // An operation may disable the trigger while the menu is open. Close it
  // permanently, so finishing the operation cannot unexpectedly reopen it.
  if (unavailable && isOpen) setIsOpen(false);
  const open = (index = options.findIndex((option) => option.value === value)) => {
    if (unavailable) return;
    search.current = { text: '', time: 0 };
    setActiveIndex(Math.max(0, Math.min(options.length - 1, index)));
    setIsOpen(true);
  };
  const close = (restoreFocus: boolean) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option || unavailable) return;
    if (option.value !== value) onChange(option.value);
    close(true);
  };

  useLayoutEffect(() => {
    const trigger = triggerRef.current, menu = menuRef.current;
    if (!isOpen || unavailable || !trigger || !menu) return;
    const place = () => {
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
      const topEdge = (viewport?.offsetTop ?? 0) + 8;
      const rightEdge = leftEdge + (viewport?.width ?? document.documentElement.clientWidth) - 16;
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(240, Math.max(0, rightEdge - leftEdge));
      menu.style.width = width + 'px';
      const desiredHeight = Math.min(320, menu.scrollHeight + 2);
      const below = Math.max(0, bottomEdge - rect.bottom - 6);
      const above = Math.max(0, rect.top - topEdge - 6);
      const down = below >= desiredHeight || below >= above;
      const maxHeight = Math.min(320, down ? below : above);
      const height = Math.min(desiredHeight, maxHeight);
      const top = down ? rect.bottom + 6 : rect.top - 6 - height;
      menu.style.left = Math.max(leftEdge, Math.min(rect.right - width, rightEdge - width)) + 'px';
      menu.style.top = Math.max(topEdge, Math.min(top, bottomEdge - height)) + 'px';
      menu.style.maxHeight = maxHeight + 'px';
      menu.style.visibility = 'visible';
    };
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !trigger.contains(event.target) && !menu.contains(event.target)) setIsOpen(false);
    };
    place();
    menu.focus({ preventScroll: true });
    const observer = new ResizeObserver(place);
    observer.observe(trigger);
    observer.observe(menu);
    // Available mode controls can grow while saved schemas finish loading.
    // Follow those layout changes even when the trigger's own size is stable.
    if (trigger.parentElement) {
      observer.observe(trigger.parentElement);
      for (const control of trigger.parentElement.children) observer.observe(control);
    }
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('focusin', dismissOutside);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('focusin', dismissOutside);
    };
  }, [isOpen, unavailable, options]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const option = menu?.querySelector<HTMLElement>('[data-engine-index="' + activeIndex + '"]');
    if (!isOpen || !menu || !option) return;
    const bounds = menu.getBoundingClientRect(), item = option.getBoundingClientRect();
    // Reveal only within the menu; scrolling an option never moves the page.
    if (item.top < bounds.top + 4) menu.scrollTop -= bounds.top + 4 - item.top;
    else if (item.bottom > bounds.bottom - 4) menu.scrollTop += item.bottom - bounds.bottom + 4;
  }, [isOpen, activeIndex]);

  const navigate = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      close(true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(activeIndex);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      setActiveIndex((current) => event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key.length === 1 && event.key.trim()) {
      event.preventDefault();
      const time = event.timeStamp;
      const query = (time - search.current.time < 500 ? search.current.text : '') + event.key.toLowerCase();
      search.current = { text: query, time };
      const prefix = new Set(query).size === 1 ? query[0] : query;
      for (let offset = 1; offset <= options.length; offset++) {
        const index = (activeIndex + offset) % options.length;
        if (options[index].label.toLowerCase().startsWith(prefix)) { setActiveIndex(index); break; }
      }
    }
  };

  return <>
    <button ref={triggerRef} type="button" className={styles.enginePicker} disabled={unavailable}
      aria-label={'Select SQL dialect. Current engine: ' + name} title={'Select SQL dialect: ' + name}
      aria-haspopup="listbox" aria-expanded={isOpen && !unavailable} aria-controls={isOpen ? menuId : undefined}
      onClick={() => isOpen ? close(true) : open()}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          open(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
            : Math.max(0, options.findIndex((option) => option.value === value)));
        }
      }}>
      <EngineLogo name={name} /><CaretDownIcon size={12} aria-hidden="true" className={styles.engineCaret} />
    </button>
    {isOpen && !unavailable && createPortal(
      <ul ref={menuRef} id={menuId} role="listbox" aria-label="SQL dialect" tabIndex={-1}
        aria-activedescendant={menuId + '-option-' + activeIndex} className={styles.engineMenu} onKeyDown={navigate}>
        {options.map((option, index) => <li key={option.value} id={menuId + '-option-' + index} role="option"
          data-engine-index={index} aria-selected={option.value === value} data-active={index === activeIndex}
          className={styles.engineOption} onMouseDown={(event) => event.preventDefault()}
          onPointerMove={(event) => { if (event.pointerType !== 'touch') setActiveIndex(index); }}
          onClick={() => choose(index)}>
          <EngineLogo name={option.label} /><span>{option.label}</span>
          {option.value === value && <CheckIcon size={14} weight="bold" aria-hidden="true" />}
        </li>)}
      </ul>, document.body)}
  </>;
}

// The document export endpoint supports MongoDB only; this identifies that
// engine without suggesting additional, unsupported document dialects.
export function SchemaEngineBadge({ name }: { name: string }) {
  return <span className={styles.engineBadge} role="img" aria-label={'Database engine: ' + name} title={name}>
    <EngineLogo name={name} />
  </span>;
}
