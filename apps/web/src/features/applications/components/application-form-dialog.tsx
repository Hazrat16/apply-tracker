'use client';

import type {
  ApplicationDetail,
  ApplicationStatus,
  CreateApplicationInput,
} from '@apply-tracker/shared';
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
import { useCreateApplication, useUpdateApplication } from '../hooks';
import { ApplicationForm } from './application-form';

/** Form values for editing an existing application. */
export function toFormValues(app: ApplicationDetail): Partial<CreateApplicationInput> {
  return {
    companyName: app.company.name,
    roleTitle: app.roleTitle,
    status: app.status,
    priority: app.priority,
    jobUrl: app.jobUrl ?? '',
    location: app.location ?? '',
    workMode: app.workMode,
    source: app.source,
    salaryMin: app.salaryMin,
    salaryMax: app.salaryMax,
    currency: app.currency,
    appliedAt: app.appliedAt,
    jobDescription: app.jobDescription ?? '',
    tagIds: app.tags.map((tag) => tag.id),
  };
}

interface CreateDialogProps {
  trigger: React.ReactElement;
  /** Pre-selects the status, e.g. when adding from a board column. */
  status?: ApplicationStatus;
  /** Open the new application's page after creating it. */
  openAfterCreate?: boolean;
}

export function CreateApplicationDialog({ trigger, status, openAfterCreate }: CreateDialogProps) {
  const [open, setOpen] = useState(false);
  const create = useCreateApplication();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add application</DialogTitle>
          <DialogDescription>
            Only company and role are required — fill in the rest later.
          </DialogDescription>
        </DialogHeader>
        <ApplicationForm
          submitLabel="Add application"
          defaultValues={status ? { status } : undefined}
          onSubmit={async (data) => {
            const created = await create.mutateAsync(data);
            setOpen(false);
            toast.success('Application added', {
              description: `${created.roleTitle} at ${created.company.name}`,
            });
            if (openAfterCreate) router.push(`/applications/${created.id}`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function EditApplicationDialog({
  application,
  trigger,
}: {
  application: ApplicationDetail;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const update = useUpdateApplication(application.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit application</DialogTitle>
          <DialogDescription>
            {application.roleTitle} at {application.company.name}
          </DialogDescription>
        </DialogHeader>
        <ApplicationForm
          submitLabel="Save changes"
          defaultValues={toFormValues(application)}
          onSubmit={async (data) => {
            await update.mutateAsync(data);
            setOpen(false);
            toast.success('Application updated');
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
