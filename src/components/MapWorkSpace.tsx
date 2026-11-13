'use client';

import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
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
import { OverviewChangeController } from '@/lib/overview-change';
import { OverviewChangeComposer } from './OverviewChangeComposer';
import { ArchitectureChangeController } from '@/lib/architecture-change';
import { ArchitectureChangeComposer } from './ArchitectureChangeComposer';
import type { ArchitectureCanvasMemory } from '@/lib/architecture-canvas-memory';
import { TechStackChangeController } from '@/lib/tech-stack-change';
import { TechStackChangeComposer } from './TechStackChangeComposer';

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

function MapWorkspaceContent({ mapId, data: initialData, revision }: { mapId: string; data: MapprSystem; revision?: number }) {
  const workspaceId = useId();
  // Arrow keys move focus; Enter/Space activates a view. Moving through the
  // tab list must not mount views or start their saved-artifact requests.
  const [activeView, setActiveView] = useState<ViewId>('architecture');

  const [changes] = useState(() => new OverviewChangeController(mapId, initialData, revision));
  const changeState = useSyncExternalStore(changes.subscribe, changes.getSnapshot, changes.getSnapshot);
  const [architectureChanges] = useState(() => new ArchitectureChangeController(changes));
  const architectureChangeState = useSyncExternalStore(architectureChanges.subscribe, architectureChanges.getSnapshot, architectureChanges.getSnapshot);
  const [techStackChanges] = useState(() => new TechStackChangeController(changes));
  const techStackChangeState = useSyncExternalStore(techStackChanges.subscribe, techStackChanges.getSnapshot, techStackChanges.getSnapshot);
  const [selectedArchitectureId, setSelectedArchitectureId] = useState<string | null>(null);
  const [architectureTargetMode, setArchitectureTargetMode] = useState<'whole' | 'selected'>('whole');
  const [architectureCanvasMemory, setArchitectureCanvasMemory] = useState<ArchitectureCanvasMemory>(() => ({ positions: {} }));
  const { data } = changeState.canonical;
  const selectedArchitectureNode = data.architecture.nodes.find((node) => node.id === selectedArchitectureId) ?? null;
  const selectArchitectureNode = useCallback((id: string | null) => {
    setSelectedArchitectureId(id);
    if (architectureTargetMode === 'selected') architectureChanges.setTarget(id ?? '');
  }, [architectureTargetMode, architectureChanges]);
  const chooseArchitectureTarget = (mode: 'whole' | 'selected') => {
    setArchitectureTargetMode(mode);
    architectureChanges.setTarget(mode === 'whole' ? null : selectedArchitectureNode?.id ?? '');
  };
  const artifactAuthority = useMemo(() => ({ revision: changes.getRevision, refresh: changes.refreshForArtifacts }), [changes]);
  useEffect(() => {
    changes.retain();
    architectureChanges.retain();
    techStackChanges.retain();
    return () => { techStackChanges.release(); architectureChanges.release(); changes.release(); };
  }, [changes, architectureChanges, techStackChanges]);
  useEffect(() => {
    if (activeView !== 'overview' && activeView !== 'architecture' && activeView !== 'tech-stack') return;
    const activeChanges = activeView === 'overview' ? changes : activeView === 'architecture' ? architectureChanges : techStackChanges;
    void activeChanges.activate();
    const recheck = () => { void activeChanges.activate(); };
    window.addEventListener('focus', recheck);
    return () => window.removeEventListener('focus', recheck);
  }, [activeView, changes, architectureChanges, techStackChanges]);

  const activeContent = (
    <>
      {activeView === 'overview' && (
        <div className="flex min-w-0 flex-col gap-6">
          <OverviewChangeComposer controller={changes} state={changeState} />
          <Overview
            mapId={mapId}
            product={data.product}
            features={data.features}
            architecture={data.architecture}
            onSystemUpdated={changes.acceptIteration}
          />
        </div>
      )}
      {activeView === 'architecture' && (
        <div className="flex min-w-0 flex-col gap-6">
        <ArchitectureCanvas
          mapId={mapId}
          architecture={data.architecture}
          canonicalRevision={changeState.canonical.revision}
          selectedNodeId={selectedArchitectureNode?.id ?? null}
          onSelectedNodeChange={selectArchitectureNode}
          viewState={architectureCanvasMemory} onViewStateChange={setArchitectureCanvasMemory}
        />
        <ArchitectureChangeComposer controller={architectureChanges} state={architectureChangeState}
          selectedNode={selectedArchitectureNode} targetMode={architectureTargetMode} onTargetMode={chooseArchitectureTarget} />
        </div>
      )}
      {activeView === 'tech-stack' && <div className="flex min-w-0 max-w-6xl flex-col gap-6">
        <TechStackView techStack={data.techStack} />
        <TechStackChangeComposer controller={techStackChanges} state={techStackChangeState} />
      </div>}
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
      {activeView === 'all' && <AllView mapId={mapId} data={data} onSystemUpdated={changes.acceptIteration} />}
      {activeView === 'json' && <JsonView data={data} />}
    </>
  );

  return (
    <ArtifactWorkspaceProvider mapId={mapId} source={data} authority={artifactAuthority}
      sessionContext={changeState.eligibility === 'denied' ? 'access-lost' : 'workspace'}>
      <div className="flex flex-col gap-4">
        <WorkspaceTabs views={VIEWS} activeView={activeView} workspaceId={workspaceId} onActivate={setActiveView} />
        {changeState.artifactsMayBeStale && <p role="status" className="font-body text-sm text-text-muted">
          Generated output has not been regenerated by this change. Saved artifacts may be out of date; review their freshness before relying on exports.
        </p>}

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

export function MapWorkspace(props: { mapId: string; data: MapprSystem; revision?: number }) {
  return <MapWorkspaceContent key={props.mapId} {...props} />;
}
