'use client';

import type { ApplicationListParams } from '@apply-tracker/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { parseListParams, serializeListParams } from '../../list-params';

/** List filters stored in the URL, so views are shareable and survive reloads. */
export function useListParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useMemo(() => parseListParams(new URLSearchParams(searchParams)), [searchParams]);

  const update = useCallback(
    (changes: Partial<ApplicationListParams>) => {
      // Any change other than paging goes back to the first page.
      const next = { ...params, ...changes, page: changes.page ?? 1 };
      const query = serializeListParams(next);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return [params, update] as const;
}
