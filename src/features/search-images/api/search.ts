import {
  searchResponseSchema,
  toSearchParams,
  type SearchParams,
} from '@/entities/image';
import { SearchError, retryAfterSeconds } from '@/shared/api';
import { remainingCooldown, startCooldown } from '../model/cooldown';

export function shouldRetrySearch(attempt: number, error: Error) {
  return (
    attempt < 1 &&
    error instanceof SearchError &&
    ['NETWORK_ERROR', 'TIMEOUT', 'UPSTREAM_ERROR'].includes(error.code)
  );
}
export async function fetchImages(params: SearchParams, signal: AbortSignal) {
  const remaining = remainingCooldown();
  if (remaining)
    throw new SearchError(
      '잠시 후 다시 검색해주세요.',
      429,
      'RATE_LIMITED',
      remaining,
    );
  let response: Response;
  try {
    response = await fetch(`/api/search?${toSearchParams(params)}`, { signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new SearchError(
      '네트워크 연결을 확인하고 다시 시도해주세요.',
      0,
      'NETWORK_ERROR',
    );
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: unknown;
    } | null;
    const retryAfter =
      response.status === 429
        ? retryAfterSeconds(response.headers.get('Retry-After'))
        : undefined;
    if (retryAfter) startCooldown(retryAfter);
    const code =
      response.status === 429
        ? 'RATE_LIMITED'
        : response.status === 503
          ? 'CONFIGURATION_ERROR'
          : response.status === 504
            ? 'TIMEOUT'
            : response.status === 502 && body?.code === 'UPSTREAM_ERROR'
              ? 'UPSTREAM_ERROR'
              : 'SEARCH_FAILED';
    const message =
      response.status === 429
        ? '검색 요청이 많아요. 잠시 기다려주세요.'
        : response.status === 503
          ? '검색 서비스를 사용할 수 없어요. 잠시 후 다시 확인해주세요.'
          : response.status === 504
            ? '검색 시간이 초과되었어요. 다시 시도해주세요.'
            : '이미지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
    throw new SearchError(message, response.status, code, retryAfter);
  }
  const body: unknown = await response.json().catch(() => null);
  const parsed = searchResponseSchema.safeParse(body);
  if (!parsed.success)
    throw new SearchError(
      '검색 결과를 확인할 수 없어요. 다시 시도해주세요.',
      502,
      'INVALID_RESPONSE',
    );
  return parsed.data;
}
