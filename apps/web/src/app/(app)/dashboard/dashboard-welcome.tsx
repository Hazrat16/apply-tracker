'use client';

import { KanbanSquare } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMe } from '@/features/auth/hooks';

export function DashboardWelcome() {
  const { data: user } = useMe();
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {firstName ? `Welcome, ${firstName}` : 'Welcome'}
      </h1>
      <Card className="border-dashed">
        <CardHeader className="items-center py-10 text-center">
          <KanbanSquare className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
          <CardTitle>Your application board is on its way</CardTitle>
          <CardDescription>
            The Kanban board for tracking applications arrives in the next release.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
