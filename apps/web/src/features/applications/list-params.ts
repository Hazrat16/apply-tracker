import {
  type ApplicationListParams,
  applicationListQuerySchema,
  type ApplicationListQuery,
} from '@apply-tracker/shared';

export const DEFAULT_LIST_PARAMS = applicationListQuerySchema.parse({});

/** URL search params → validated list params. Invalid values fall back to defaults. */
export function parseListParams(searchParams: URLSearchParams): ApplicationListParams {
  const result = applicationListQuerySchema.safeParse(Object.fromEntries(searchParams));
  return result.success ? result.data : DEFAULT_LIST_PARAMS;
}

/** List params → query string, omitting defaults so URLs stay short and shareable. */
export function serializeListParams(params: Partial<ApplicationListParams>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [keyof ApplicationListParams, unknown][]) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
      continue;
    if (value === DEFAULT_LIST_PARAMS[key]) continue;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return search.toString();
}

/** Same as `serializeListParams`, but as API query input. */
export const toApiQuery = (params: ApplicationListParams): ApplicationListQuery => ({
  ...params,
  archived: params.archived ? 'true' : 'false',
});
