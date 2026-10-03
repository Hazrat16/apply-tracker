import type { ApplicationStatus } from '@apply-tracker/shared';
import { cn } from '@/lib/utils';
import { STATUS_DOT, STATUS_LABELS } from '../constants';

export function StatusDot({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_DOT[status], className)}
      aria-hidden
    />
  );
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      <StatusDot status={status} />
      {STATUS_LABELS[status]}
    </span>
  );
}
