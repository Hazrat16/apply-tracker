import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApplicationsView } from '@/features/applications/components/list/applications-view';

export const metadata: Metadata = { title: 'Applications' };

export default function ApplicationsPage() {
  return (
    <Suspense>
      <ApplicationsView />
    </Suspense>
  );
}
