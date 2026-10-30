'use client';

import { useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { CheckIcon, CircleNotchIcon, WarningIcon } from '@phosphor-icons/react';
import styles from './ActionButton.module.css';

export type ActionState = 'idle' | 'pending' | 'success' | 'error';
type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  ref?: Ref<HTMLButtonElement>;
  state?: ActionState;
  idleLabel: string;
  pendingLabel: string;
  successLabel?: string;
  errorLabel?: string;
  reserveLabels?: string[];
  icon?: ReactNode;
  variant?: 'primary' | 'secondary';
  compactPending?: boolean;
};

// Regular actions reserve label space. Compact actions own their one spinner
// and interpolate between their current label's measured width and a circle.
export function ActionButton({
  ref, state = 'idle', idleLabel, pendingLabel, successLabel = idleLabel,
  errorLabel = idleLabel, reserveLabels = [], icon, variant = 'primary',
  compactPending = false,
  className = '', disabled, type = 'button', ...props
}: ActionButtonProps) {
  const labels = { idle: idleLabel, pending: pendingLabel, success: successLabel, error: errorLabel };
  const buttonRef = useRef<HTMLButtonElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!compactPending) return;
    const button = buttonRef.current, measure = measureRef.current;
    if (!button || !measure) return;
    // The invisible intrinsic label stack stays expanded even while the
    // button is circular. Interpolate pixel widths, including font changes.
    const update = () => button.style.setProperty('--action-expanded-width', `${Math.ceil(measure.getBoundingClientRect().width + 56)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [compactPending]);
  return (
    <button {...props} ref={(element) => {
      buttonRef.current = element;
      if (typeof ref === 'function') return ref(element);
      if (ref) ref.current = element;
    }} type={type} disabled={disabled || state === 'pending'}
      aria-label={compactPending ? props['aria-label'] ?? labels[state] : props['aria-label']}
      data-compact-pending={compactPending}
      aria-busy={state === 'pending'} data-state={state} data-variant={variant}
      className={`${styles.button} font-mono ${className}`}>
      <span className={styles.icon} aria-hidden="true">
        {compactPending ? state === 'pending' ? <CircleNotchIcon size={14} weight="bold" className={styles.spinner} /> : icon
          : state === 'success' ? <CheckIcon size={14} weight="bold" />
          : state === 'error' ? <WarningIcon size={14} weight="bold" /> : icon}
      </span>
      <span className={styles.labels} aria-hidden={compactPending || undefined}>
        {(Object.entries(labels) as [ActionState, string][]).map(([key, label]) => (
          <span key={key} className={styles.label} data-active={state === key} aria-hidden={state !== key}>{label}</span>
        ))}
        {reserveLabels.map((label) => (
          <span key={label} className={styles.label} data-active="false" aria-hidden="true">{label}</span>
        ))}
      </span>
      {compactPending && <span ref={measureRef} className={styles.measure} aria-hidden="true">
        <span>{state === 'pending' ? idleLabel : labels[state]}</span>
      </span>}
    </button>
  );
}
