'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/monitoring';

/** Last-resort boundary for errors in the root layout itself (renders its own <html>). */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => reportError(error), [error]);

  return (
    <html lang="en">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem 1rem', textAlign: 'center' }}
      >
        <h1>Something went wrong</h1>
        <p>ApplyTracker hit an unexpected error.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  );
}
