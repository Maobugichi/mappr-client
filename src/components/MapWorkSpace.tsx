'use client';

import { useId, useState } from 'react';
import type { MapprSystem } from '@/lib/api';
import { ArtifactWorkspaceProvider } from '@/lib/artifact-workspace';
import { ArchitectureCanvas } from './ArchitectureCanvas';
import { DatabaseCanvas } from './DatabaseCanvas';
import { TechStackView } from './TechStackView';
import { DesignSystemView } from './DesignSystemView';
import { DevPlanView } from './DevPlanView';
import { ApiContractView } from './ApiContractView';
import { DatabaseSchemaView } from './DatabaseSchemaView';
import { Overview } from './Overview';
import { AdrView } from './AdrView';
import { ReadmeView } from './ReadmeView';
import { EnvVarsView } from './EnvVarsView';
import { DeploymentView } from './DeploymentView';
import { AllView } from './AllView';
import { JsonView } from './JsonView';
import { WorkspaceTabs } from './WorkspaceTabs';

type ViewId =
  | 'overview'
  | 'architecture'
  | 'tech-stack'
  | 'database'
  | 'design-system'
  | 'dev-plan'
  | 'api-contract'
  | 'database-schema'
  | 'adrs'
  | 'readme'
  | 'env-vars'
  | 'deployment'
  | 'all'
  | 'json';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'tech-stack', label: 'Tech Stack' },
  { id: 'database', label: 'Database' },
  { id: 'design-system', label: 'Design System' },
  { id: 'dev-plan', label: 'Dev Plan' },
  { id: 'api-contract', label: 'API Contract' },
  { id: 'database-schema', label: 'DB Schema' },
  { id: 'adrs', label: 'ADRs' },
  { id: 'readme', label: 'README' },
  { id: 'env-vars', label: 'Env Vars' },
  { id: 'deployment', label: 'Deployment' },
  { id: 'all', label: 'All' },
  { id: 'json', label: 'JSON' },
];

function MapWorkspaceContent({ mapId, data: initialData }: { mapId: string; data: MapprSystem }) {
  const workspaceId = useId();
  // Arrow keys move focus; Enter/Space activates a view. Moving through the
  // tab list must not mount views or start their saved-artifact requests.
  const [activeView, setActiveView] = useState<ViewId>('architecture');

  // Lifted into state (rather than read directly from the prop) so that
  // an Architecture Iteration result — which changes the whole system,
  // not just what ArchitectureCanvas renders — propagates to every
  // other view (JSON, All, etc.) without a full page reload.
  const [data, setData] = useState<MapprSystem>(initialData);

  const activeContent = (
    <>
      {activeView === 'overview' && (
        <Overview
          mapId={mapId}
          product={data.product}
          features={data.features}
          architecture={data.architecture}
          onSystemUpdated={setData}
        />
      )}
      {activeView === 'architecture' && (
        <ArchitectureCanvas
          mapId={mapId}
          architecture={data.architecture}
          onSystemUpdated={setData}
        />
      )}
      {activeView === 'tech-stack' && <TechStackView techStack={data.techStack} />}
      {activeView === 'database' && <DatabaseCanvas dataModel={data.dataModel} />}
      {activeView === 'design-system' && <DesignSystemView designSystem={data.designSystem} />}
      {activeView === 'dev-plan' && (
        <DevPlanView developmentPlan={data.developmentPlan} features={data.features} />
      )}
      {activeView === 'api-contract' && (
        <ApiContractView mapId={mapId} productName={data.meta.productName} />
      )}
      {activeView === 'database-schema' && (
        <DatabaseSchemaView
          mapId={mapId}
          productName={data.meta.productName}
          techStack={data.techStack}
        />
      )}
      {activeView === 'adrs' && <AdrView mapId={mapId} productName={data.meta.productName} />}
      {activeView === 'readme' && (
        <ReadmeView mapId={mapId} productName={data.meta.productName} />
      )}
      {activeView === 'env-vars' && (
        <EnvVarsView mapId={mapId} nodes={data.architecture.nodes} />

      )}
      {activeView === 'deployment' && <DeploymentView mapId={mapId} />}
      {activeView === 'all' && <AllView mapId={mapId} data={data} onSystemUpdated={setData} />}
      {activeView === 'json' && <JsonView data={data} />}
    </>
  );

  return (
    <ArtifactWorkspaceProvider mapId={mapId} source={data}>
      <div className="flex flex-col gap-4">
        <WorkspaceTabs views={VIEWS} activeView={activeView} workspaceId={workspaceId} onActivate={setActiveView} />

        {VIEWS.map((view) => (
          <div
            key={view.id}
            id={`${workspaceId}-panel-${view.id}`}
            role="tabpanel"
            aria-labelledby={`${workspaceId}-tab-${view.id}`}
            hidden={activeView !== view.id}
            tabIndex={activeView === view.id ? 0 : -1}
            className="min-w-0"
          >
            {activeView === view.id ? activeContent : null}
          </div>
        ))}
      </div>
    </ArtifactWorkspaceProvider>
  );
}

export function MapWorkspace(props: { mapId: string; data: MapprSystem }) {
  return <MapWorkspaceContent key={props.mapId} {...props} />;
}
