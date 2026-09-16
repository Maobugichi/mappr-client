'use client';

import { useState } from 'react';
import type { MapprSystem } from '@/lib/api';
import { ArchitectureCanvas } from './ArchitectureCanvas';
import { DatabaseCanvas } from './DatabaseCanvas';
import { TechStackView } from './TechStackView';
import { DesignSystemView } from './DesignSystemView';
import { DevPlanView } from './DevPlanView';
import { Overview } from './Overview';
import { AllView } from './AllView';

type ViewId =
  | 'overview'
  | 'architecture'
  | 'tech-stack'
  | 'database'
  | 'design-system'
  | 'dev-plan'
  | 'all'
  | 'json';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'tech-stack', label: 'Tech Stack' },
  { id: 'database', label: 'Database' },
  { id: 'design-system', label: 'Design System' },
  { id: 'dev-plan', label: 'Dev Plan' },
  { id: 'all', label: 'All' },
  { id: 'json', label: 'JSON' },
];

export function MapWorkspace({ mapId, data }: { mapId: string; data: MapprSystem }) {
  // Defaults to Architecture rather than Overview — it's the one view
  // that's actually finished, so that's what a first-time viewer should
  // land on rather than a placeholder.
  const [activeView, setActiveView] = useState<ViewId>('architecture');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 border-b border-canvas-grid pb-2">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`rounded-full px-3 py-1.5 font-mono text-xs transition-colors ${
              activeView === view.id
                ? 'bg-signal text-canvas'
                : 'text-text-muted hover:bg-surface-raised hover:text-text'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {activeView === 'overview' && (
        <Overview mapId={mapId} product={data.product} features={data.features} />
      )}
      {activeView === 'architecture' && (
        <ArchitectureCanvas mapId={mapId} architecture={data.architecture} />
      )}
      {activeView === 'tech-stack' && <TechStackView techStack={data.techStack} />}
      {activeView === 'database' && <DatabaseCanvas dataModel={data.dataModel} />}
      {activeView === 'design-system' && <DesignSystemView designSystem={data.designSystem} />}
      {activeView === 'dev-plan' && (
        <DevPlanView developmentPlan={data.developmentPlan} features={data.features} />
      )}
      {activeView === 'all' && <AllView mapId={mapId} data={data} />}
      {activeView === 'json' && (
        <pre className="max-h-[600px] overflow-auto rounded-lg bg-surface-raised p-4 font-mono text-xs text-text">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}