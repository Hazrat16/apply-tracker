import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { CreateApplicationDialog } from '@/features/applications/components/application-form-dialog';
import { Board } from '@/features/applications/components/board/board';

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
        <CreateApplicationDialog
          trigger={
            <Button>
              <Plus aria-hidden />
              Add application
            </Button>
          }
        />
      </div>
      <Board />
    </div>
  );
}
