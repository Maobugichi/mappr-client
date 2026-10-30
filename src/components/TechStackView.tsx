'use client';

import { useId } from 'react';
import type { MapprSystem } from '@/lib/api';
import { TechnologyLogo } from './TechnologyLogo';
import styles from './TechStackView.module.css';

type Technology = MapprSystem['techStack'][number];

function TechnologyDetails({ technology }: { technology: Technology }) {
  return (
    <>
      <div className={styles.identity}>
        <TechnologyLogo name={technology.choice} className={styles.logo} />
        <div className={styles.identityCopy}>
          <h3 className={styles.name}>{technology.choice}</h3>
          <p className={styles.role}><span className="sr-only">Technical role: </span>{technology.category}</p>
        </div>
      </div>
      <p className={styles.rationale}>{technology.rationale}</p>
    </>
  );
}

export function TechStackView({ techStack }: { techStack: MapprSystem['techStack'] }) {
  const inventoryId = useId();

  return (
    <section className={styles.inventory} aria-labelledby={inventoryId + '-heading'}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Tech stack</p>
          <h2 id={inventoryId + '-heading'} className={styles.title}>Technology inventory</h2>
        </div>
        {techStack.length > 0 && <p className={styles.count}>
          {techStack.length} {techStack.length === 1 ? 'technology' : 'technologies'}
        </p>}
      </header>

      {techStack.length === 0 ? <p className={styles.empty}>No technologies have been specified for this map.</p> : (
        <ul className={styles.technologies}>
          {techStack.map((technology, index) => (
            // Source positions distinguish repeated categories and choices.
            <li key={JSON.stringify([technology.category, technology.choice, index])} className={styles.technology}>
              <TechnologyDetails technology={technology} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
