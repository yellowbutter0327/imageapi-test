'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  imageSearchKey,
  pageSizeForWidth,
  readSearchParams,
  toSearchParams,
  type SearchParams,
} from '@/entities/image';
import { fetchImages, shouldRetrySearch } from '../api/search';
import { useSearchCooldown } from './cooldown';

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

export function useImageSearch() {
  const url = useSearchParams();
  const retryIn = useSearchCooldown();
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
    enabled: params !== null && retryIn === 0,
    queryFn: ({ signal }) => {
      if (!params) throw new Error('Viewport has not hydrated');
      return fetchImages(params, signal);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: shouldRetrySearch,
    retryDelay: 500,
    refetchOnWindowFocus: false,
  });
  function update(changes: Partial<SearchParams>) {
    if (!params) return;
    const next = { ...params, ...changes };
    const nextUrl = toSearchParams(next).toString();
    if (canonical !== nextUrl)
      window.history.pushState(null, '', `?${nextUrl}`);
  }
  async function refresh() {
    if (!retryIn && !query.isFetching) await query.refetch();
  }
  return { params, query, update, retryIn, refresh };
}
