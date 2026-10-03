import { redisOptionsFromUrl } from './redis-connection.js';

describe('redisOptionsFromUrl', () => {
  it('parses host, port and database', () => {
    expect(redisOptionsFromUrl('redis://localhost:6380/2')).toMatchObject({
      host: 'localhost',
      port: 6380,
      db: 2,
      tls: undefined,
      maxRetriesPerRequest: null,
    });
  });

  it('parses credentials and enables TLS for rediss://', () => {
    expect(redisOptionsFromUrl('rediss://default:p%40ss@cache.example.com:6379')).toMatchObject({
      username: 'default',
      password: 'p@ss',
      tls: {},
      db: 0,
    });
  });
});
