import { DescribeProductForm } from '@/components/DescribeProductForm';

export default function Home() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-10 bg-canvas px-6 py-20"
      style={{
        backgroundImage:
          'linear-gradient(var(--color-canvas-grid) 1px, transparent 1px), linear-gradient(90deg, var(--color-canvas-grid) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="font-mono text-xs uppercase tracking-widest text-trace">Mappr</span>
        <h1 className="max-w-xl font-display text-2xl font-semibold text-text sm:text-3xl">
          Describe your product. Get a system map.
        </h1>
        <p className="max-w-md font-body text-base text-text-muted">
          Explain what you want to build in plain language — Mappr turns it into an architecture,
          tech stack, data model, and build plan.
        </p>
      </div>

      <DescribeProductForm />
    </div>
  );
}