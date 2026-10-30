'use client';

import { useState, type ReactNode } from 'react';
import styles from './MotionDisclosure.module.css';

export function MotionDisclosure({
  isOpen, children, className = '', id,
}: {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  // Keep the last open contents during exit. Presentation never delays the
  // authoritative open state, and a reopen uses current props immediately.
  const [retainedChildren, setRetainedChildren] = useState<ReactNode>(null);
  if (isOpen && retainedChildren !== children) setRetainedChildren(children);

  return (
    <div
      id={id}
      className={`${styles.disclosure} ${className}`}
      data-open={isOpen}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <div className={styles.content}>
        {isOpen ? children : retainedChildren}
      </div>
    </div>
  );
}
