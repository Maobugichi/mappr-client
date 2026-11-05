'use client';

import type { ComponentProps, HTMLAttributes } from 'react';
import { ArrowsClockwiseIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { ActionButton } from './ActionButton';
import styles from './ArtifactActions.module.css';

export function ArtifactActions({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`${styles.actions} ${className}`} />;
}

type ArtifactActionProps = ComponentProps<typeof ActionButton> & {
  action: 'generate' | 'export';
  regenerate?: boolean;
};

// Keep action sizing, responsive labels and brand-independent icons in one place.
// Views still own their requests, formats, error labels and initial Generate icon.
export function ArtifactActionButton({
  action, regenerate = false, icon, className = '', title, ...props
}: ArtifactActionProps) {
  return <ActionButton {...props} compactPending data-artifact-action={action}
    aria-label={props['aria-label'] ?? (props.state === 'pending' ? props.pendingLabel : title ?? props.idleLabel)}
    title={title ?? props.idleLabel} className={`${styles.action} ${className}`}
    icon={action === 'export' ? <DownloadSimpleIcon size={14} weight="bold" />
      : regenerate ? <ArrowsClockwiseIcon size={14} weight="bold" /> : icon} />;
}
