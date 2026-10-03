'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { JobImportFlow } from './job-import-flow';

export function ImportJobDialog({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a job</DialogTitle>
          <DialogDescription>
            Paste a link and we&apos;ll fill in the details for you to check.
          </DialogDescription>
        </DialogHeader>
        {/* Remount on open so every import starts fresh. */}
        {open && (
          <JobImportFlow
            onCreated={(application) => {
              setOpen(false);
              toast.success('Saved to Wishlist', {
                description: `${application.roleTitle} at ${application.company.name}`,
                action: {
                  label: 'Open',
                  onClick: () => router.push(`/applications/${application.id}`),
                },
              });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
