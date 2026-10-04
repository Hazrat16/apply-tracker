import { KanbanSquare } from 'lucide-react';
import Link from 'next/link';

/** `compact` hides the wordmark on small screens (the icon stays). */
export function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold">
      <KanbanSquare className="size-5" aria-hidden />
      <span className={compact ? 'max-sm:sr-only' : undefined}>ApplyTracker</span>
    </Link>
  );
}
