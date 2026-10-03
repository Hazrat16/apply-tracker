'use client';

import { Download, Link2, Plus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportJobDialog } from '@/features/job-import/import-job-dialog';
import { cn } from '@/lib/utils';
import { applicationsApi } from '../../api';
import { useApplicationList } from '../../hooks';
import { CreateApplicationDialog } from '../application-form-dialog';
import { ApplicationsTable } from './applications-table';
import { ImportDialog } from './import-dialog';
import { ListToolbar } from './list-toolbar';
import { Pagination } from './pagination';
import { useListParams } from './use-list-params';

export function ApplicationsView() {
  const [params, update] = useListParams();
  const { data, isPending, error, isPlaceholderData } = useApplicationList(params);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground">
            Search, filter and sort everything you&apos;ve applied to.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportDialog />
          <a
            href={applicationsApi.exportUrl}
            download
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <Download aria-hidden />
            Export CSV
          </a>
          <ImportJobDialog
            trigger={
              <Button variant="outline" size="sm">
                <Link2 aria-hidden />
                Import from link
              </Button>
            }
          />
          <CreateApplicationDialog
            openAfterCreate
            trigger={
              <Button size="sm">
                <Plus aria-hidden />
                Add application
              </Button>
            }
          />
        </div>
      </div>

      <ListToolbar params={params} onChange={update} />

      {isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : error ? (
        <p role="alert" className="py-16 text-center text-muted-foreground">
          Couldn&apos;t load applications. {error.message}
        </p>
      ) : data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="font-medium">No applications found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.total === 0 && params.page === 1
              ? 'Try different filters, or add your first application.'
              : 'This page is empty.'}
          </p>
        </div>
      ) : (
        <div className={cn('space-y-4 transition-opacity', isPlaceholderData && 'opacity-60')}>
          <ApplicationsTable
            items={data.items}
            params={params}
            onSort={(sort, order) => update({ sort, order })}
          />
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={(page) => update({ page })}
          />
        </div>
      )}
    </div>
  );
}
