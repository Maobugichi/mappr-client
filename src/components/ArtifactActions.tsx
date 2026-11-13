'use client';

import type { ComponentProps, HTMLAttributes } from 'react';
import { ArrowsClockwiseIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { ActionButton } from './ActionButton';
import { useArtifactSafety } from './ArtifactSafety';
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
  const safety = useArtifactSafety();
  const blocked = action === 'export' && !safety?.canExport && props.state !== 'pending';
  return <ActionButton {...props} compactPending data-artifact-action={action}
    disabled={props.disabled || blocked} aria-describedby={blocked ? safety?.descriptionId : props['aria-describedby']}
    aria-label={props['aria-label'] ?? (props.state === 'pending' ? props.pendingLabel : title ?? props.idleLabel)}
    title={blocked ? 'Export requires verified current output. Refresh current output first.' : title ?? props.idleLabel} className={`${styles.action} ${className}`}
    icon={action === 'export' ? <DownloadSimpleIcon size={14} weight="bold" />
      : regenerate ? <ArrowsClockwiseIcon size={14} weight="bold" /> : icon} />;
}
