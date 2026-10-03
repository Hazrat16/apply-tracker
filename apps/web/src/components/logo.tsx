import { KanbanSquare } from 'lucide-react';
import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold">
      <KanbanSquare className="size-5" aria-hidden />
      ApplyTracker
    </Link>
  );
}
