import type { ApplicationDetail } from '@apply-tracker/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PRIORITY_LABELS, SOURCE_LABELS, WORK_MODE_LABELS } from '../../constants';
import { formatDateOnly, formatSalary, timeAgo } from '../../format';
import { TagBadge } from '../tag-badge';

export function DetailsCard({ application: app }: { application: ApplicationDetail }) {
  const rows: [string, React.ReactNode][] = [
    ['Location', app.location],
    ['Work mode', app.workMode && WORK_MODE_LABELS[app.workMode]],
    ['Salary', formatSalary(app.salaryMin, app.salaryMax, app.currency)],
    ['Priority', PRIORITY_LABELS[app.priority]],
    ['Found via', app.source && SOURCE_LABELS[app.source]],
    ['Applied on', app.appliedAt && formatDateOnly(app.appliedAt)],
    ['Added', timeAgo(app.createdAt)],
    ['Last updated', timeAgo(app.updatedAt)],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words">
                {value || <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
          ))}
        </dl>
        {app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {app.tags.map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
