import 'server-only';
import { SearchError } from '@/shared/api';
import type { RedisConfig } from '@/shared/api/index.server';

export type SearchConfig =
  | { mode: 'demo' }
  | {
      mode: 'live';
      clientId: string;
      clientSecret: string;
      store?: RedisConfig;
      perMinute: number;
      perDay: number;
    };

export function getSearchConfig(env = process.env): SearchConfig {
  const mode = env.SEARCH_MODE ?? 'demo';
  if (mode === 'demo') return { mode };
  if (
    mode !== 'live' ||
    !env.NAVER_CLIENT_ID?.trim() ||
    !env.NAVER_CLIENT_SECRET?.trim()
  ) {
    throw new SearchError(
      '검색 서비스 설정을 확인하고 다시 시도해주세요.',
      503,
      'CONFIGURATION_ERROR',
    );
  }
  let store: RedisConfig | undefined;
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (url || token) {
    let valid = false;
    try {
      const parsed = new URL(url ?? '');
      valid =
        parsed.protocol === 'https:' &&
        parsed.hostname.endsWith('.upstash.io') &&
        !parsed.username &&
        !parsed.password &&
        parsed.pathname === '/' &&
        !parsed.search &&
        !parsed.hash;
    } catch {
      /* Invalid server configuration. */
    }
    if (!valid || !token?.trim())
      throw new SearchError(
        '공유 검색 저장소 설정을 확인해주세요.',
        503,
        'CONFIGURATION_ERROR',
      );
    store = { url: url!, token };
  }
  function limit(value: string | undefined, fallback: number) {
    if (value === undefined) return fallback;
    const result = Number(value);
    if (
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(result) ||
      result < 1 ||
      result > 100000
    )
      throw new SearchError(
        '검색 호출 한도 설정을 확인해주세요.',
        503,
        'CONFIGURATION_ERROR',
      );
    return result;
  }
  return {
    mode,
    clientId: env.NAVER_CLIENT_ID,
    clientSecret: env.NAVER_CLIENT_SECRET,
    store,
    perMinute: limit(env.SEARCH_REQUESTS_PER_MINUTE, 60),
    perDay: limit(env.SEARCH_REQUESTS_PER_DAY, 2000),
  };
}
