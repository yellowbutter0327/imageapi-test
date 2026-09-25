import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchImages,
  shouldRetrySearch,
} from '@/features/search-images/api/search';
import { SearchError, retryAfterSeconds } from '@/shared/api';

const params = {
  q: '티셔츠',
  page: 1,
  pageSize: 12 as const,
  sort: 'sim' as const,
};
beforeEach(() => {
  // Node 25 also exposes localStorage; use an explicit browser-storage test double.
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
  });
});
afterEach(() => {
  vi.useRealTimers();
});
describe('retry policy and response validation', () => {
  it.each([
    ['12', 12],
    ['invalid', 60],
    [null, 60],
    ['0', 1],
    ['Thu, 01 Jan 1970 00:01:30 GMT', 30],
  ])('parses Retry-After %s', (header, expected) => {
    expect(retryAfterSeconds(header, 60_000)).toBe(expected);
  });
  it('retries only transient errors once', () => {
    for (const code of ['NETWORK_ERROR', 'TIMEOUT', 'UPSTREAM_ERROR']) {
      const error = new SearchError('', 502, code);
      expect(shouldRetrySearch(0, error)).toBe(true);
      expect(shouldRetrySearch(1, error)).toBe(false);
    }
    for (const code of [
      'INVALID_RESPONSE',
      'CONFIGURATION_ERROR',
      'RATE_LIMITED',
      'SEARCH_FAILED',
    ]) {
      expect(shouldRetrySearch(0, new SearchError('', 502, code))).toBe(false);
    }
  });
  it('normalizes malformed JSON into a non-retryable response error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{broken')));
    await expect(
      fetchImages(params, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it.each([
    ['UPSTREAM_ERROR', true],
    ['INVALID_UPSTREAM', false],
  ])('applies the retry policy to provider error %s', async (code, retry) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ code }, { status: 502 })),
    );
    const error = await fetchImages(params, new AbortController().signal).catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(SearchError);
    expect(shouldRetrySearch(0, error as SearchError)).toBe(retry);
    expect(shouldRetrySearch(1, error as SearchError)).toBe(false);
  });
  it('does not convert cancellation into a retryable network failure', async () => {
    const controller = new AbortController();
    controller.abort();
    const reason = new DOMException('aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(reason));
    await expect(fetchImages(params, controller.signal)).rejects.toBe(reason);
  });
  it('normalizes network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(
      fetchImages(params, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
  it('honors a shared tab cooldown without sending another request', async () => {
    localStorage.setItem('image-search:retry-at', String(Date.now() + 20_000));
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      fetchImages(params, new AbortController().signal),
    ).rejects.toMatchObject({ status: 429 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
