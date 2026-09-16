import type { MapprSystem } from '@/lib/api';

export function DevPlanView({
  developmentPlan,
  features,
}: {
  developmentPlan: MapprSystem['developmentPlan'];
  features: MapprSystem['features'];
}) {
  const sortedPhases = [...developmentPlan].sort((a, b) => a.phase - b.phase);
  const nameById = new Map(features.map((feature) => [feature.id, feature.name]));

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-canvas-grid bg-canvas p-6">
      {sortedPhases.map((phase, index) => (
        <div key={phase.phase} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal font-mono text-xs font-semibold text-canvas">
              {phase.phase}
            </div>
            {index < sortedPhases.length - 1 && (
              <div className="mt-1 w-px flex-1 bg-canvas-grid" />
            )}
          </div>

          <div className="flex-1 pb-2">
            <p className="font-display text-base font-semibold text-text">{phase.title}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {phase.items.map((item, itemIndex) => {
                // Older generations (pre relatedFeatures) stored items as
                // plain strings — normalize so stale rows in the DB don't
                // crash the view instead of just losing the feature badges.
                const raw = item as unknown as string | typeof item;
                const description = typeof raw === 'string' ? raw : raw.description;
                const relatedFeatures = typeof raw === 'string' ? [] : (raw.relatedFeatures ?? []);

                return (
                  <li key={itemIndex} className="flex flex-col gap-1">
                    <div className="flex gap-2 font-body text-sm text-text-muted">
                      <span className="text-trace">–</span>
                      <span>{description}</span>
                    </div>
                    {relatedFeatures.length > 0 && (
                      <div className="ml-4 flex flex-wrap items-center gap-1.5">
                        {relatedFeatures.map((featureId) => (
                          <span
                            key={featureId}
                            className="rounded bg-surface-raised px-2 py-0.5 font-mono text-[10px] text-trace"
                          >
                            {nameById.get(featureId) ?? featureId}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}