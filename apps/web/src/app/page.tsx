import {
  BarChart3,
  BellRing,
  Briefcase,
  KanbanSquare,
  Link2,
  type LucideIcon,
  Sparkles,
} from 'lucide-react';
import { ApiStatus } from '@/components/api-status';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: KanbanSquare,
    title: 'Kanban board',
    description:
      'Drag applications from Wishlist to Offer and see your whole pipeline at a glance.',
  },
  {
    icon: Link2,
    title: 'Import from a link',
    description: 'Share a LinkedIn or job board link and the job lands on your board, pre-filled.',
  },
  {
    icon: BellRing,
    title: 'Follow-up reminders',
    description: 'Never forget to follow up. Get nudged when an application goes quiet.',
  },
  {
    icon: BarChart3,
    title: 'Search analytics',
    description: 'Response rate, interview rate and which sources actually get you callbacks.',
  },
  {
    icon: Sparkles,
    title: 'AI resume match',
    description: 'Compare your resume with a job description and see which skills are missing.',
  },
  {
    icon: Briefcase,
    title: 'Interviews & contacts',
    description: 'Keep interview rounds, recruiters and notes together with each application.',
  },
];

export default function Home() {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold">
            <KanbanSquare className="size-5" aria-hidden />
            ApplyTracker
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16">
        <section className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">
            In development
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Track every job application in one place
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Stop losing track of where you applied. ApplyTracker organises your job search, reminds
            you to follow up, and shows you what is working.
          </p>
        </section>

        <section aria-label="Features" className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="mb-2 size-5 text-muted-foreground" aria-hidden />
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} ApplyTracker</span>
          <ApiStatus />
        </div>
      </footer>
    </>
  );
}
