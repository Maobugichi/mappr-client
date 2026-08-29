import type { MapprSystem } from '@/lib/api';

export function Overview({
  product,
  features,
}: {
  product: MapprSystem['product'];
  features: MapprSystem['features'];
}) {
  const nameById = new Map(features.map((feature) => [feature.id, feature.name]));

  return (
    <div className="flex flex-col gap-8 rounded-lg border border-canvas-grid bg-canvas p-6">
      <section>
        <p className="font-body text-base text-text">{product.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {product.concepts.map((concept) => (
            <span
              key={concept}
              className="rounded-full border border-trace/40 px-3 py-1 font-mono text-[11px] text-trace"
            >
              {concept}
            </span>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-text-muted">
          Features
        </p>
        <div className="flex flex-col gap-3">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="rounded-lg border border-canvas-grid bg-surface-raised p-4"
            >
              <p className="font-display text-sm font-semibold text-text">{feature.name}</p>
              <p className="mt-1 font-body text-sm text-text-muted">{feature.description}</p>

              {feature.dependsOn.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] text-text-muted">depends on:</span>
                  {feature.dependsOn.map((depId) => (
                    <span
                      key={depId}
                      className="rounded bg-canvas px-2 py-0.5 font-mono text-[10px] text-trace"
                    >
                      {nameById.get(depId) ?? depId}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}