import type { ApplicationSummary } from '@apply-tracker/shared';
import { CalendarClock, Flag, MapPin } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatPlace, formatSalary, formatUpcoming, timeAgo } from '../../format';
import { TagBadge } from '../tag-badge';

interface ApplicationCardProps {
  application: ApplicationSummary;
  /** Rendered in the drag overlay: no link, lifted look. */
  overlay?: boolean;
}

export function ApplicationCard({ application: app, overlay }: ApplicationCardProps) {
  const salary = formatSalary(app.salaryMin, app.salaryMax, app.currency);
  const place = formatPlace(app.location, app.workMode);

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card p-3 text-sm shadow-xs transition-shadow hover:shadow-sm',
        overlay && 'rotate-2 cursor-grabbing shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">{app.company.name}</p>
        {app.priority === 'HIGH' && (
          <Flag
            className="size-3.5 shrink-0 fill-red-500 text-red-500"
            aria-label="High priority"
          />
        )}
      </div>

      {overlay ? (
        <p className="mt-0.5 font-medium leading-snug">{app.roleTitle}</p>
      ) : (
        <Link
          href={`/applications/${app.id}`}
          // Stretched link: the whole card is clickable, while drag listeners stay on the card.
          className="mt-0.5 block font-medium leading-snug outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {app.roleTitle}
        </Link>
      )}

      {(place || salary) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {place && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{place}</span>
            </span>
          )}
          {salary && <span>{salary}</span>}
        </div>
      )}

      {app.nextInterviewAt && (
        <p className="mt-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <CalendarClock className="size-3" aria-hidden />
          Interview {formatUpcoming(app.nextInterviewAt)}
        </p>
      )}

      {app.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {app.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
          {app.tags.length > 3 && (
            <span className="text-[11px] text-muted-foreground">+{app.tags.length - 3}</span>
          )}
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted-foreground">Updated {timeAgo(app.updatedAt)}</p>
    </div>
  );
}
