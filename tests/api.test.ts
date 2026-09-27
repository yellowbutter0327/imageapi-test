// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/_app/api/search-route.server';

const upstream = {
  total: 2500,
  items: [
    {
      title: '<b>티셔츠</b> &amp; 포스터',
      link: 'https://example.com/original.jpg',
      thumbnail: 'https://example.com/thumb.jpg',
      sizewidth: '800',
      sizeheight: '600',
    },
  ],
};
function request(query = 'q=티셔츠&pageSize=12') {
  return new Request(`http://localhost/api/search?${query}`);
}
function live() {
  vi.stubEnv('SEARCH_MODE', 'live');
  vi.stubEnv('NAVER_CLIENT_ID', 'test-id');
  vi.stubEnv('NAVER_CLIENT_SECRET', 'test-secret');
}
afterEach(() => vi.unstubAllEnvs());

describe('Next search route', () => {
  it.each([12, 20, 28, 40])(
    'returns %i demo images without external calls',
    async (size) => {
      vi.stubEnv('SEARCH_MODE', 'demo');
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      const response = await GET(request(`q=티셔츠&pageSize=${size}`));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items).toHaveLength(size);
      expect(data.total).toBe(72);
      expect(data.mode).toBe('demo');
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    'q=&pageSize=12',
    'q=a&q=b&pageSize=12',
    'q=a&pageSize=24',
    'q=a&pageSize=40&page=26',
    'q=a&pageSize=12&sort=old',
    'q=a',
    'q=a&pageSize=12&url=https://example.com',
  ])('rejects invalid input before upstream: %s', async (query) => {
    live();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect((await GET(request(query))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not fall back to demo when live credentials are absent', async () => {
    live();
    vi.stubEnv('NAVER_CLIENT_SECRET', '');
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('CONFIGURATION_ERROR');
  });
  it('rejects misspelled mode rather than hiding a configuration error', async () => {
    vi.stubEnv('SEARCH_MODE', 'liv');
    expect((await GET(request())).status).toBe(503);
  });
  it('keeps credentials upstream and caps the final page at the product limit', async () => {
    live();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(upstream));
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(
      request('q=티셔츠&sort=date&page=36&pageSize=28'),
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.total).toBe(1000);
    expect(data.items[0].title).toBe('티셔츠 & 포스터');
    expect(JSON.stringify(data)).not.toMatch(/test-secret|test-id/);
    const [url, options] = fetcher.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.origin).toBe('https://openapi.naver.com');
    expect(parsed.searchParams.get('start')).toBe('981');
    expect(parsed.searchParams.get('display')).toBe('20');
    expect(parsed.searchParams.get('sort')).toBe('date');
    expect(options?.headers).toEqual({
      'X-Naver-Client-Id': 'test-id',
      'X-Naver-Client-Secret': 'test-secret',
    });
    expect(options?.redirect).toBe('error');
  });
  it.each([401, 500, 429])(
    'handles upstream %i without exposing provider details or caching errors',
    async (status) => {
      live();
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response('private-provider-details', { status }),
          ),
      );
      const response = await GET(request());
      expect(response.status).toBe(
        status === 429 ? 429 : status === 401 ? 503 : 502,
      );
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('X-Request-Id')).toBeTruthy();
      expect(await response.text()).not.toContain('private-provider-details');
      if (status === 429)
        expect(response.headers.get('Retry-After')).toBe('60');
    },
  );
  it('rejects unsafe links from the upstream response', async () => {
    live();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          ...upstream,
          items: [{ ...upstream.items[0], link: 'javascript:alert(1)' }],
        }),
      ),
    );
    expect((await GET(request())).status).toBe(502);
  });
  it('returns a timeout response', async () => {
    live();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')),
    );
    expect((await GET(request())).status).toBe(504);
  });
  it('classifies a provider connection failure as retryable', async () => {
    live();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('private-connection-details')),
    );
    const response = await GET(request());
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.code).toBe('UPSTREAM_ERROR');
    expect(JSON.stringify(data)).not.toContain('private-connection-details');
  });
  it.each(['{broken', JSON.stringify({ items: [] })])(
    'keeps malformed provider data non-retryable: %s',
    async (body) => {
      live();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
      const response = await GET(request());
      expect(response.status).toBe(502);
      expect((await response.json()).code).toBe('INVALID_UPSTREAM');
    },
  );
  it('does not classify an aborted provider request as a connection failure', async () => {
    live();
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')),
    );
    const response = await GET(
      new Request(request(), { signal: controller.signal }),
    );
    expect(response.status).toBe(499);
    expect((await response.json()).code).toBe('CANCELLED');
  });
});
