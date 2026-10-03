import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function setup() {
  const reply = vi.fn();
  const adapterHost = {
    httpAdapter: { reply, getRequestUrl: () => '/api/v1/things/1' },
  } as unknown as HttpAdapterHost;
  const host = {
    switchToHttp: () => ({ getRequest: () => ({ id: 'req-1' }), getResponse: () => ({}) }),
  } as unknown as ArgumentsHost;
  return { filter: new AllExceptionsFilter(adapterHost), host, reply };
}

describe('AllExceptionsFilter', () => {
  it('formats HTTP exceptions', () => {
    const { filter, host, reply } = setup();
    filter.catch(new NotFoundException('Thing not found'), host);

    expect(reply).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        statusCode: 404,
        error: 'NOT_FOUND',
        message: 'Thing not found',
        path: '/api/v1/things/1',
        requestId: 'req-1',
      }),
      404,
    );
  });

  it('hides details of unexpected errors', () => {
    const { filter, host, reply } = setup();
    vi.spyOn(filter['logger'], 'error').mockImplementation(() => {});
    filter.catch(new Error('db password leaked in stack'), host);

    expect(reply).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
      500,
    );
  });
});
