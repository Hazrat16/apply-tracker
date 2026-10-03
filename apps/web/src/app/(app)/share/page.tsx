import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ShareView } from './share-view';

export const metadata: Metadata = { title: 'Save shared job' };

/** Target of the PWA share sheet ("Share → ApplyTracker" from LinkedIn, Facebook, a browser…). */
export default function SharePage() {
  return (
    <Suspense>
      <ShareView />
    </Suspense>
  );
}
