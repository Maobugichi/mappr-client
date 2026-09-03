'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { DownloadIcon, FileTextIcon, FilePdfIcon } from '@phosphor-icons/react';
import { generateMarkdown, downloadTextFile } from '@/lib/markdown-export';
import { MapPdfDocument } from './MapPdfDocument';
import type { MapprSystem } from '@/lib/api';


const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => <span className="font-mono text-xs text-text-muted">…</span> }
);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function ExportMenu({ data }: { data: MapprSystem }) {
  const [isOpen, setIsOpen] = useState(false);
  const filenameBase = slugify(data.meta.productName) || 'mappr-export';

  function handleMarkdownDownload() {
    const markdown = generateMarkdown(data);
    downloadTextFile(`${filenameBase}.md`, markdown, 'text/markdown');
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-2 rounded-full border border-canvas-grid px-3 py-1.5 font-mono text-xs text-text hover:bg-surface-raised"
      >
        <DownloadIcon size={14} />
        Export
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-lg border border-canvas-grid bg-surface p-1 shadow-lg">
          <button
            onClick={handleMarkdownDownload}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left font-mono text-xs text-text hover:bg-surface-raised"
          >
            <FileTextIcon size={14} />
            Markdown (.md)
          </button>

          <PDFDownloadLink
            document={<MapPdfDocument data={data} />}
            fileName={`${filenameBase}.pdf`}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left font-mono text-xs text-text hover:bg-surface-raised"
          >
            {({ loading }: { loading: boolean }) => (
              <>
                <FilePdfIcon size={14} />
                {loading ? 'Preparing PDF…' : 'PDF (.pdf)'}
              </>
            )}
          </PDFDownloadLink>
        </div>
      )}
    </div>
  );
}