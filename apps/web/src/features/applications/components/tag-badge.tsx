import type { Tag } from '@apply-tracker/shared';
import { cn } from '@/lib/utils';
import { TAG_STYLES } from '../constants';

export function TagBadge({
  tag,
  className,
}: {
  tag: Pick<Tag, 'name' | 'color'>;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 text-[11px] leading-none font-medium',
        TAG_STYLES[tag.color],
        className,
      )}
    >
      {tag.name}
    </span>
  );
}
