import type { MapprSystem } from '@/lib/api';

export function DevPlanView({
  developmentPlan,
}: {
  developmentPlan: MapprSystem['developmentPlan'];
}) {
  const sortedPhases = [...developmentPlan].sort((a, b) => a.phase - b.phase);

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
            <ul className="mt-2 flex flex-col gap-1.5">
              {phase.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-2 font-body text-sm text-text-muted">
                  <span className="text-trace">–</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}