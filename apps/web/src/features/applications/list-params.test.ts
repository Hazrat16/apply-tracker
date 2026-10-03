import { DEFAULT_LIST_PARAMS, parseListParams, serializeListParams } from './list-params';

describe('list params', () => {
  it('round-trips through the URL', () => {
    const params = {
      ...DEFAULT_LIST_PARAMS,
      search: 'engineer',
      status: ['APPLIED', 'INTERVIEW'] as const,
      archived: true,
      page: 3,
    };
    const query = serializeListParams({ ...params, status: [...params.status] });
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({
      search: 'engineer',
      status: 'APPLIED,INTERVIEW',
      archived: 'true',
      page: '3',
    });
    expect(parseListParams(new URLSearchParams(query))).toEqual({
      ...params,
      status: ['APPLIED', 'INTERVIEW'],
    });
  });

  it('omits defaults', () => {
    expect(serializeListParams(DEFAULT_LIST_PARAMS)).toBe('');
  });

  it('falls back to defaults for invalid URLs', () => {
    expect(parseListParams(new URLSearchParams('status=HIRED&page=-1'))).toEqual(
      DEFAULT_LIST_PARAMS,
    );
  });
});
