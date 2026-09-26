import 'server-only';
import { SearchError } from '@/shared/api';

export type SearchConfig =
  { mode: 'demo' } | { mode: 'live'; clientId: string; clientSecret: string };

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
  return {
    mode,
    clientId: env.NAVER_CLIENT_ID,
    clientSecret: env.NAVER_CLIENT_SECRET,
  };
}
