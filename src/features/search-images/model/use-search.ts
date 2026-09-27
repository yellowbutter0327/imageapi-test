'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  imageSearchKey,
  pageSizeForWidth,
  readSearchParams,
  searchResponseSchema,
  toSearchParams,
  type SearchParams,
} from '@/entities/image';
import { SearchError } from '@/shared/api';

const mediaQueries = [
  '(min-width: 1200px)',
  '(min-width: 1440px)',
  '(min-width: 1900px)',
];
function subscribe(onChange: () => void) {
  const media = mediaQueries.map((query) => window.matchMedia(query));
  media.forEach((query) => query.addEventListener('change', onChange));
  return () =>
    media.forEach((query) => query.removeEventListener('change', onChange));
}
const getSnapshot = () => pageSizeForWidth(window.innerWidth);
const getServerSnapshot = () => null;

export async function fetchImages(params: SearchParams, signal: AbortSignal) {
  const response = await fetch(`/api/search?${toSearchParams(params)}`, {
    signal,
  });
  if (!response.ok) {
    const message =
      response.status === 429
        ? '검색 요청이 많아요. 1분 후 다시 시도해주세요.'
        : response.status === 503
          ? '검색 서비스가 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.'
          : response.status === 504
            ? '검색 시간이 초과되었어요. 다시 시도해주세요.'
            : '이미지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
    throw new SearchError(message, response.status, 'SEARCH_FAILED');
  }
  const parsed = searchResponseSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new SearchError(
      '검색 결과를 확인할 수 없어요. 다시 시도해주세요.',
      502,
      'INVALID_RESPONSE',
    );
  return parsed.data;
}

export function useImageSearch() {
  const url = useSearchParams();
  const pageSize = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const params = pageSize
    ? readSearchParams(new URLSearchParams(url.toString()), pageSize)
    : null;
  const canonical = params ? toSearchParams(params).toString() : null;
  const current = url.toString();
  useEffect(() => {
    if (canonical && canonical !== current)
      window.history.replaceState(null, '', `?${canonical}`);
  }, [canonical, current]);

  const query = useQuery({
    queryKey: params ? imageSearchKey(params) : ['images', 'awaiting-viewport'],
    enabled: params !== null,
    queryFn: ({ signal }) => {
      if (!params) throw new Error('Viewport has not hydrated');
      return fetchImages(params, signal);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: (attempt, error) =>
      attempt < 1 &&
      !(
        error instanceof SearchError &&
        (error.status < 500 || error.status === 503)
      ),
    refetchOnWindowFocus: false,
  });
  function update(changes: Partial<SearchParams>) {
    if (!params) return;
    const next = { ...params, ...changes };
    const nextUrl = toSearchParams(next).toString();
    if (canonical !== nextUrl)
      window.history.pushState(null, '', `?${nextUrl}`);
  }
  return { params, query, update };
}
