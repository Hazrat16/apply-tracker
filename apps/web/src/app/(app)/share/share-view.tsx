'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { JobImportFlow } from '@/features/job-import/job-import-flow';
import { findSharedUrl } from '@/features/job-import/shared-link';

export function ShareView() {
  const params = useSearchParams();
  const router = useRouter();
  const url = findSharedUrl(params.get('url'), params.get('text'), params.get('title'));
  // Some apps share a post's text without a link; that can be read as pasted text.
  const text = url ? undefined : (params.get('text') ?? undefined);

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Save a shared job</CardTitle>
        <CardDescription>
          Check the details we found, then save it to your Wishlist.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <JobImportFlow
          initialUrl={url ?? undefined}
          initialText={text}
          autoStart={!!url}
          onCreated={(application) => {
            toast.success('Saved to Wishlist', {
              description: `${application.roleTitle} at ${application.company.name}`,
            });
            router.replace(`/applications/${application.id}`);
          }}
        />
      </CardContent>
    </Card>
  );
}
