import type { Metadata } from 'next';
import { ApplicationDetailView } from '@/features/applications/components/detail/application-detail-view';

export const metadata: Metadata = { title: 'Application' };

export default async function ApplicationPage({ params }: PageProps<'/applications/[id]'>) {
  const { id } = await params;
  return <ApplicationDetailView id={id} />;
}
