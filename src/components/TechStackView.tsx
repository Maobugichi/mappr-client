import type { MapprSystem } from '@/lib/api';

export function TechStackView({ techStack }: { techStack: MapprSystem['techStack'] }) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-lg border border-canvas-grid bg-canvas p-4 sm:grid-cols-2 lg:grid-cols-3">
      {techStack.map((item) => (
        <div
          key={item.category}
          className="rounded-lg border border-canvas-grid bg-surface-raised p-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-wide text-trace">
            {item.category}
          </p>
          <p className="mt-1 font-display text-base font-semibold text-text">{item.choice}</p>
          <p className="mt-2 font-body text-sm text-text-muted">{item.rationale}</p>
        </div>
      ))}
    </div>
  );
}