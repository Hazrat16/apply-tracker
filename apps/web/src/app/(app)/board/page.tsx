import { Link2, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { CreateApplicationDialog } from '@/features/applications/components/application-form-dialog';
import { Board } from '@/features/applications/components/board/board';
import { ImportJobDialog } from '@/features/job-import/import-job-dialog';

export const metadata: Metadata = { title: 'Board' };

export default function BoardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
          <p className="text-sm text-muted-foreground">
            Drag applications between stages as they progress.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportJobDialog
            trigger={
              <Button variant="outline">
                <Link2 aria-hidden />
                Import from link
              </Button>
            }
          />
          <CreateApplicationDialog
            trigger={
              <Button>
                <Plus aria-hidden />
                Add application
              </Button>
            }
          />
        </div>
      </div>
      <Board />
    </div>
  );
}
