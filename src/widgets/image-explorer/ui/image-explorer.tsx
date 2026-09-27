'use client';
import { useRef, useState } from 'react';
import { ImageOff, SlidersHorizontal, RotateCcw } from 'lucide-react';
import {
  DEFAULT_QUERY,
  ImageCard,
  MAX_RESULTS,
  type ImageItem,
  type Sort,
} from '@/entities/image';
import { useImageSearch, SearchForm } from '@/features/search-images';
import { ImagePreview } from '@/features/preview-image';
import { Button } from '@/shared/ui';
import { Pagination } from './pagination';
import { SearchSkeleton } from './search-skeleton';

export function ImageExplorer() {
  const { params, query, update } = useImageSearch();
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const results = useRef<HTMLElement | null>(null);
  const totalPages = params
    ? Math.ceil((query.data?.total ?? 0) / params.pageSize)
    : 0;
  const isLoading = !params || query.isPending;
  return (
    <>
      <SearchForm
        key={params?.q ?? DEFAULT_QUERY}
        initialQuery={params?.q ?? DEFAULT_QUERY}
        ready={params !== null}
        onSearch={(q) => update({ q, page: 1 })}
      />
      <section
        className="results-section"
        aria-label="검색 결과"
        aria-busy={query.isFetching || !params}
        ref={results}
      >
        <div className="results-toolbar">
          <div className="results-title">
            <h2>
              {params?.q ?? DEFAULT_QUERY}
              <span> 검색 결과</span>
            </h2>
            <p>
              {query.data ? (
                <>
                  <strong>{query.data.total.toLocaleString()}</strong>개의
                  이미지
                </>
              ) : (
                '영감을 모으고 있어요'
              )}
            </p>
          </div>
          <div className="results-controls">
            {query.data?.mode === 'demo' && (
              <span className="mode-badge">
                <span />
                샘플 데모
              </span>
            )}
            <label className="sort-control">
              <SlidersHorizontal size={15} aria-hidden="true" />
              <span className="sr-only">정렬</span>
              <select
                disabled={!params}
                value={params?.sort ?? 'sim'}
                onChange={(event) =>
                  update({ sort: event.target.value as Sort, page: 1 })
                }
              >
                <option value="sim">정확도순</option>
                <option value="date">최신순</option>
              </select>
            </label>
          </div>
        </div>
        {query.data?.mode === 'demo' && (
          <p className="demo-note">
            API 키 없이 둘러보는 샘플입니다. 티셔츠 · 포스터 · 패턴을
            검색해보세요.
          </p>
        )}
        <p className="sr-only" role="status">
          {isLoading
            ? '이미지를 검색하고 있습니다.'
            : query.isError
              ? '검색에 실패했습니다.'
              : `${query.data?.total ?? 0}개 결과 중 ${params.page}페이지입니다.`}
        </p>
        {isLoading ? (
          <SearchSkeleton />
        ) : query.isError ? (
          <div className="state-panel" role="alert">
            <ImageOff size={32} aria-hidden="true" />
            <h3>검색 결과를 불러오지 못했어요.</h3>
            <p>{query.error.message}</p>
            <Button onClick={() => void query.refetch()}>
              <RotateCcw size={16} aria-hidden="true" />
              다시 시도
            </Button>
          </div>
        ) : !query.data?.items.length ? (
          <div className="state-panel">
            <ImageOff size={32} aria-hidden="true" />
            <h3>
              {query.data?.total
                ? '이 페이지에는 이미지가 없어요.'
                : '검색 결과가 없어요.'}
            </h3>
            <p>다른 검색어로 새로운 영감을 찾아보세요.</p>
            {params.page > 1 && (
              <Button onClick={() => update({ page: 1 })}>첫 페이지로</Button>
            )}
          </div>
        ) : (
          <ul className="image-grid" aria-label="이미지 검색 결과">
            {query.data.items.map((image, index) => (
              <ImageCard
                key={`${image.id}:${image.thumbnail}`}
                image={image}
                priority={index === 0}
                onSelect={() => {
                  opener.current = document.activeElement as HTMLElement;
                  setSelected(image);
                }}
              />
            ))}
          </ul>
        )}
        {query.data && !query.isError && (
          <>
            <div className="results-footnote">
              <span>{params?.pageSize ?? '—'}개씩 둘러보기</span>
              <span>
                {params?.page} / {Math.max(1, totalPages)} 페이지
              </span>
            </div>
            {query.data.total === MAX_RESULTS && (
              <p className="demo-note">최대 1,000개까지 탐색할 수 있어요.</p>
            )}
            <Pagination
              page={params?.page ?? 1}
              totalPages={totalPages}
              onChange={(page) => {
                update({ page });
                results.current?.scrollIntoView({
                  block: 'start',
                  behavior: 'instant',
                });
              }}
            />
          </>
        )}
      </section>
      <ImagePreview
        image={selected}
        onClose={() => setSelected(null)}
        returnFocus={() => opener.current?.focus()}
      />
    </>
  );
}
