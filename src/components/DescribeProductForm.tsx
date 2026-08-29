'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { generateMap, ApiError } from '@/lib/api';

const MIN_LENGTH = 20;

export function DescribeProductForm() {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedLength = description.trim().length;
  const canSubmit = trimmedLength >= MIN_LENGTH && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const map = await generateMap(description);
      router.push(`/maps/${map.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? 'Something went wrong generating your map.');
      } else {
        setError('Could not reach Mappr. Check that the backend is running.');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-4">
      <label
        htmlFor="product-description"
        className="font-mono text-xs uppercase tracking-wide text-text-muted"
      >
        Describe your product
      </label>

      <textarea
        id="product-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="A marketplace where Nigerian creators sell ebooks, courses and templates. Creators have storefronts, buyers purchase with Paystack, and purchased products are delivered securely."
        rows={6}
        disabled={isSubmitting}
        className="w-full resize-none rounded-lg border border-canvas-grid bg-surface-raised px-4 py-3 font-body text-base text-text placeholder:text-text-muted focus:border-trace focus:outline-none focus:ring-1 focus:ring-trace disabled:opacity-60"
      />

      {error && (
        <p className="font-mono text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-text-muted">
          {isSubmitting
            ? 'Generating your map…'
            : trimmedLength < MIN_LENGTH
              ? `${MIN_LENGTH - trimmedLength} more characters needed`
              : 'Ready to generate'}
        </span>

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 font-mono text-sm font-medium text-canvas transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? 'Generating…' : 'Generate map'}
          <ArrowRightIcon size={16} weight="bold" />
        </button>
      </div>
    </form>
  );
}