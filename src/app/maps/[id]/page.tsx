import { notFound } from 'next/navigation';
import { getMap, ApiError } from '@/lib/api';
import { MapWorkspace } from '@/components/MapWorkSpace';

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let map;
  try {
    map = await getMap(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 bg-canvas p-8 text-text">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-trace">Mappr / Map</p>
        <h1 className="font-display text-2xl font-semibold">{map.data.meta.productName}</h1>
        <p className="max-w-xl font-body text-text-muted">{map.data.meta.oneLineSummary}</p>
      </div>

      <MapWorkspace data={map.data} />
    </div>
  );
}