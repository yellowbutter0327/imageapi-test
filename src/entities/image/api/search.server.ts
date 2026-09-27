import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { SearchError, retryAfterSeconds } from '@/shared/api';
import type { SearchConfig } from '@/shared/config/index.server';
import {
  MAX_RESULTS,
  searchResponseSchema,
  type SearchParams,
  type SearchResponse,
} from '../model/search';
import { searchDemo } from './demo.server';

const upstreamSchema = z.object({
  total: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      title: z.string(),
      link: z.string(),
      thumbnail: z.string(),
      sizewidth: z.coerce.number().int().nonnegative(),
      sizeheight: z.coerce.number().int().nonnegative(),
    }),
  ),
});

function plainTitle(value: string) {
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return value
    .replace(/<[^>]*>/g, '')
    .replace(
      /&(amp|lt|gt|quot|apos|nbsp);/g,
      (_, name: string) => entities[name] ?? '',
    )
    .trim();
}

export async function searchImages(
  params: SearchParams,
  config: SearchConfig,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<SearchResponse> {
  if (config.mode === 'demo') return searchDemo(params);
  const start = (params.page - 1) * params.pageSize + 1;
  const url = new URL('https://openapi.naver.com/v1/search/image');
  url.search = new URLSearchParams({
    query: params.q,
    sort: params.sort,
    start: String(start),
    display: String(Math.min(params.pageSize, MAX_RESULTS - start + 1)),
  }).toString();
  const timeout = AbortSignal.timeout(8000);
  try {
    const response = await fetcher(url, {
      headers: {
        'X-Naver-Client-Id': config.clientId,
        'X-Naver-Client-Secret': config.clientSecret,
      },
      signal: AbortSignal.any([signal, timeout]),
      cache: 'no-store',
      redirect: 'error',
    }).catch((error: unknown) => {
      if (
        signal.aborted ||
        timeout.aborted ||
        (error instanceof Error && error.name === 'TimeoutError')
      )
        throw error;
      throw new SearchError(
        '이미지 검색 서비스에 연결할 수 없어요. 잠시 후 다시 시도해주세요.',
        502,
        'UPSTREAM_ERROR',
      );
    });
    if (!response.ok) {
      if (response.status === 429)
        throw new SearchError(
          '검색 요청이 많아요. 잠시 후 다시 시도해주세요.',
          429,
          'RATE_LIMITED',
          retryAfterSeconds(response.headers.get('Retry-After')),
        );
      if ([401, 403].includes(response.status))
        throw new SearchError(
          '검색 서비스 설정을 확인해주세요.',
          503,
          'CONFIGURATION_ERROR',
        );
      throw new SearchError(
        '이미지 검색 서비스에 연결할 수 없어요. 잠시 후 다시 시도해주세요.',
        502,
        'UPSTREAM_ERROR',
      );
    }
    const data = upstreamSchema.parse(await response.json());
    const seen = new Set<string>();
    return searchResponseSchema.parse({
      mode: 'live',
      total: Math.min(data.total, MAX_RESULTS),
      items: data.items
        .map((item) => ({
          id: createHash('sha256').update(item.link).digest('hex').slice(0, 20),
          title: plainTitle(item.title) || '제목 없는 이미지',
          thumbnail: item.thumbnail,
          original: item.link,
          width: item.sizewidth,
          height: item.sizeheight,
        }))
        .filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        }),
    });
  } catch (error) {
    if (error instanceof SearchError) throw error;
    if (signal.aborted)
      throw new SearchError('취소된 검색입니다.', 499, 'CANCELLED');
    if (
      timeout.aborted ||
      (error instanceof Error && error.name === 'TimeoutError')
    )
      throw new SearchError(
        '검색 시간이 초과되었어요. 다시 시도해주세요.',
        504,
        'TIMEOUT',
      );
    throw new SearchError(
      '검색 결과를 불러오지 못했어요. 다시 시도해주세요.',
      502,
      'INVALID_UPSTREAM',
    );
  }
}
