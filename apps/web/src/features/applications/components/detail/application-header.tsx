'use client';

import type { ApplicationDetail, ApplicationStatus } from '@apply-tracker/shared';
import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { STATUS_LABELS } from '../../constants';
import { useDeleteApplication, useUpdateApplication } from '../../hooks';
import { EditApplicationDialog } from '../application-form-dialog';
import { StatusDot } from '../status-badge';

export function ApplicationHeader({ application: app }: { application: ApplicationDetail }) {
  const router = useRouter();
  const update = useUpdateApplication(app.id);
  const remove = useDeleteApplication();
  const archived = app.archivedAt !== null;

  const changeStatus = (status: ApplicationStatus) =>
    update.mutate(
      { status },
      {
        onSuccess: () => toast.success(`Moved to ${STATUS_LABELS[status]}`),
        onError: (error) => toast.error(error.message),
      },
    );

  const toggleArchive = () =>
    update.mutate(
      { archived: !archived },
      {
        onSuccess: () =>
          toast.success(archived ? 'Restored to the board' : 'Archived — hidden from the board'),
        onError: (error) => toast.error(error.message),
      },
    );

  const onDelete = () =>
    remove.mutate(app.id, {
      onSuccess: () => {
        toast.success('Application deleted');
        router.replace('/applications');
      },
      onError: (error) => toast.error(error.message),
    });

  return (
    <header className="space-y-4">
      <Link
        href="/board"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to board
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-muted-foreground">{app.company.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{app.roleTitle}</h1>
          {archived && (
            <p className="mt-1 text-sm text-muted-foreground">Archived — not shown on the board.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={STATUS_LABELS}
            value={app.status}
            onValueChange={(status) => status && changeStatus(status as ApplicationStatus)}
          >
            <SelectTrigger aria-label="Status" className="min-w-36" disabled={update.isPending}>
              <StatusDot status={app.status} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <SelectItem key={status} value={status}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {app.jobUrl && (
            <a
              href={app.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              <ExternalLink aria-hidden />
              Job posting
            </a>
          )}

          <EditApplicationDialog
            application={app}
            trigger={
              <Button variant="outline">
                <Pencil aria-hidden />
                Edit
              </Button>
            }
          />

          <Button variant="outline" onClick={toggleArchive} disabled={update.isPending}>
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {archived ? 'Restore' : 'Archive'}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="destructive" size="icon" aria-label="Delete application" />}
            >
              <Trash2 />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this application?</AlertDialogTitle>
                <AlertDialogDescription>
                  {app.roleTitle} at {app.company.name}, with its notes, contacts and interviews,
                  will be deleted permanently. To just hide it from the board, archive it instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
                  Delete permanently
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  );
}
