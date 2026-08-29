import type { MapprSystem } from '@/lib/api';

export function DesignSystemView({
  designSystem,
}: {
  designSystem: MapprSystem['designSystem'];
}) {
  return (
    <div className="flex flex-col gap-8 rounded-lg border border-canvas-grid bg-canvas p-6">
      <section>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-text-muted">
          Colors
        </p>
        <div className="flex flex-wrap gap-4">
          {designSystem.colors.map((color) => (
            <div key={color.token} className="flex flex-col items-center gap-2">
              <div
                className="h-14 w-14 rounded-lg border border-canvas-grid"
                style={{ backgroundColor: color.value }}
              />
              <p className="font-mono text-[10px] text-text">{color.token}</p>
              <p className="font-mono text-[10px] text-text-muted">{color.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-text-muted">
          Typography
        </p>
        <div className="flex flex-col gap-2">
          {designSystem.typography.map((type) => (
            <div
              key={type.token}
              className="flex items-center justify-between gap-4 border-b border-canvas-grid pb-2"
            >
              <p className="font-mono text-[11px] text-text-muted">{type.token}</p>
              <p className="font-mono text-[11px] text-text">{type.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-text-muted">
          Spacing
        </p>
        <div className="flex items-end gap-4">
          {designSystem.spacing.map((space) => (
            <div key={space.token} className="flex flex-col items-center gap-2">
              <div
                className="rounded bg-trace"
                style={{ width: space.value, height: space.value, minWidth: 4, minHeight: 4 }}
              />
              <p className="font-mono text-[10px] text-text-muted">{space.token}</p>
              <p className="font-mono text-[10px] text-text-muted">{space.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-text-muted">
          Components
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {designSystem.components.map((component) => (
            <div
              key={component.name}
              className="rounded-lg border border-canvas-grid bg-surface-raised p-3"
            >
              <p className="font-display text-sm font-medium text-text">{component.name}</p>
              <p className="mt-1 font-body text-xs text-text-muted">{component.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}