// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '@/_app/api/search-route.server';
import { getSearchConfig } from '@/shared/config/index.server';

const item = {
  title: '샘플',
  link: 'https://example.com/original.jpg',
  thumbnail: 'https://example.com/thumb.jpg',
  sizewidth: '400',
  sizeheight: '400',
};
const params = 'q=sample&sort=sim&page=1&pageSize=12';
function setup() {
  vi.stubEnv('SEARCH_MODE', 'live');
  vi.stubEnv('NAVER_CLIENT_ID', 'fixture-id');
  vi.stubEnv('NAVER_CLIENT_SECRET', 'fixture-secret');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fixture.upstash.io');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'redis-fixture-token');
  const values = new Map<string, { value: string; expires: number }>();
  const commands: (string | number)[][] = [];
  let quota = 0;
  let failure = false;
  const upstream = vi.fn(() => Response.json({ total: 1, items: [item] }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, options?: RequestInit) => {
      if (String(url).startsWith('https://openapi.naver.com/'))
        return upstream();
      expect(options?.headers).toMatchObject({
        Authorization: 'Bearer redis-fixture-token',
      });
      const command = JSON.parse(String(options?.body)) as (string | number)[];
      commands.push(command);
      if (failure) return new Response('', { status: 500 });
      const key = String(command[1]);
      if (command[0] === 'GET') {
        const entry = values.get(key);
        return Response.json({
          result: entry && entry.expires > Date.now() ? entry.value : null,
        });
      }
      if (command[0] === 'EVAL') return Response.json({ result: quota });
      if (command[0] === 'SET') {
        values.set(key, {
          value: String(command[2]),
          expires: Date.now() + Number(command[4]) * 1000,
        });
        return Response.json({ result: 'OK' });
      }
      throw new Error('Unexpected command');
    }),
  );
  return {
    commands,
    upstream,
    setQuota: (value: number) => {
      quota = value;
    },
    setFailure: () => {
      failure = true;
    },
  };
}
function request(query = params) {
  return GET(new Request(`http://localhost/api/search?${query}`));
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it('shares normalized successes for 60 seconds and expires them', async () => {
  vi.useFakeTimers();
  const { upstream, commands } = setup();
  expect((await request()).status).toBe(200);
  expect((await request()).status).toBe(200);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(commands.filter((c) => c[0] === 'EVAL')).toHaveLength(1);
  expect(commands.find((c) => c[0] === 'SET')?.slice(3)).toEqual(['EX', 60]);
  vi.advanceTimersByTime(60_001);
  expect((await request()).status).toBe(200);
  expect(upstream).toHaveBeenCalledTimes(2);
});
it('separates every search condition and credential namespace', async () => {
  const { commands } = setup();
  for (const query of [
    params,
    params.replace('sample', 'other'),
    params.replace('sim', 'date'),
    params.replace('page=1', 'page=2'),
    params.replace('12', '20'),
  ])
    await request(query);
  vi.stubEnv('NAVER_CLIENT_ID', 'another-id');
  await request();
  const keys = commands.filter((c) => c[0] === 'GET').map((c) => c[1]);
  expect(new Set(keys).size).toBe(6);
  expect(JSON.stringify(keys)).not.toMatch(/fixture-id|sample|fixture-secret/);
});
it('does not call upstream when a shared quota is exhausted', async () => {
  const { upstream, setQuota } = setup();
  setQuota(42);
  const response = await request();
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('42');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(upstream).not.toHaveBeenCalled();
});
it('fails closed when the configured quota store is unavailable', async () => {
  const { upstream, setFailure } = setup();
  setFailure();
  expect((await request()).status).toBe(503);
  expect(upstream).not.toHaveBeenCalled();
});
it('does not cache upstream errors', async () => {
  const { upstream, commands } = setup();
  upstream.mockReturnValue(new Response('', { status: 500 }));
  expect((await request()).status).toBe(502);
  expect((await request()).status).toBe(502);
  expect(upstream).toHaveBeenCalledTimes(2);
  expect(commands.filter((c) => c[0] === 'SET')).toHaveLength(0);
});
it('rejects incomplete or unsafe storage configuration', () => {
  setup();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'http://localhost:6379');
  expect(() => getSearchConfig()).toThrow();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fixture.upstash.io');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  expect(() => getSearchConfig()).toThrow();
});
