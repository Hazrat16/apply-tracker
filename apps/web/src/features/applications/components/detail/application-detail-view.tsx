'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiAssistant } from '@/features/ai/ai-assistant';
import { ApiError } from '@/lib/api-client';
import { useApplication } from '../../hooks';
import { ActivityTimeline } from './activity-timeline';
import { ApplicationHeader } from './application-header';
import { ContactsSection } from './contacts-section';
import { DetailsCard } from './details-card';
import { InterviewsSection } from './interviews-section';
import { RemindersSection } from './reminders-section';

export function ApplicationDetailView({ id }: { id: string }) {
  const { data: app, isPending, error } = useApplication(id);

  if (isPending) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading application">
        <Skeleton className="h-16 w-96 max-w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <div className="py-16 text-center" role="alert">
        <p className="font-medium">
          {notFound ? 'Application not found' : "Couldn't load this application"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {notFound ? 'It may have been deleted.' : error.message}
        </p>
        <Link
          href="/applications"
          className="mt-4 inline-block text-sm underline underline-offset-4"
        >
          Back to applications
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ApplicationHeader application={app} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Tabs defaultValue="activity" className="min-w-0">
          <TabsList>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="interviews">Interviews ({app.interviews.length})</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({app.contacts.length})</TabsTrigger>
            <TabsTrigger value="reminders">Reminders</TabsTrigger>
            <TabsTrigger value="ai">AI assistant</TabsTrigger>
          </TabsList>
          <TabsContent value="activity" className="pt-4">
            <ActivityTimeline application={app} />
          </TabsContent>
          <TabsContent value="interviews" className="pt-4">
            <InterviewsSection application={app} />
          </TabsContent>
          <TabsContent value="contacts" className="pt-4">
            <ContactsSection application={app} />
          </TabsContent>
          <TabsContent value="reminders" className="pt-4">
            <RemindersSection application={app} />
          </TabsContent>
          <TabsContent value="ai" className="pt-4">
            <AiAssistant application={app} />
          </TabsContent>
        </Tabs>

        <aside className="space-y-6">
          <DetailsCard application={app} />
          {app.jobDescription && (
            <Card>
              <CardHeader>
                <CardTitle>Job description</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Focusable so keyboard users can scroll a long description. */}
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Job description text"
                  className="max-h-96 overflow-y-auto rounded-md text-sm whitespace-pre-wrap outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {app.jobDescription}
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
