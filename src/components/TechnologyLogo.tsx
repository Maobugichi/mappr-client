'use client';

import { CodeIcon } from '@phosphor-icons/react';
import { resolveTechnologyLogo } from '@/lib/technology-logo';

export function TechnologyLogo({ name, className }: { name: string; className?: string }) {
  const icon = resolveTechnologyLogo(name);
  // The adjacent name supplies the accessible label; the logo is decorative.
  return <span className={className} aria-hidden="true" data-technology-logo={icon?.slug ?? 'generic'}>
    {icon ? <svg width={30} height={30} viewBox="0 0 24 24" fill="currentColor" focusable="false">
      <path d={icon.path} />
    </svg> : <CodeIcon size={30} weight="regular" />}
  </span>;
}
