import styles from './ProcessingIndicator.module.css';

// Mount only for a real pending operation; never imply estimated progress.
export function ProcessingIndicator({ label, description, compact = false, className = '' }: {
  label: string;
  description?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={`${styles.processing} ${compact ? styles.compact : ''} ${className}`} data-processing-indicator>
      <svg className={styles.orbit} width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        {[1, 0.6, 0.3].map((opacity, index) => (
          <circle key={index} cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeDasharray="10 34" opacity={opacity} transform={`rotate(${index * 120} 10 10)`} />
        ))}
      </svg>
      <div className={styles.copy}>
        <p className="font-body text-sm text-text">{label}</p>
        {description && <p className="mt-1 font-body text-xs text-text-muted">{description}</p>}
      </div>
    </div>
  );
}
