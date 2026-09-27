'use client';
import { useState, type FormEvent } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import { Button } from '@/shared/ui';

export function SearchForm({
  initialQuery,
  onSearch,
  ready = true,
}: {
  initialQuery: string;
  onSearch: (q: string) => void;
  ready?: boolean;
}) {
  const [draft, setDraft] = useState(initialQuery);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim() && ready) onSearch(draft.trim());
  }
  return (
    <div className="search-area">
      <form role="search" onSubmit={submit} className="search-form">
        <Search size={22} aria-hidden="true" className="search-icon" />
        <label className="sr-only" htmlFor="image-query">
          이미지 검색어
        </label>
        <input
          id="image-query"
          name="q"
          type="search"
          placeholder="어떤 영감을 찾고 있나요?"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={100}
          autoComplete="off"
        />
        <Button type="submit" disabled={!draft.trim() || !ready}>
          검색 <ArrowUpRight size={17} aria-hidden="true" />
        </Button>
      </form>
      <div className="suggestions" aria-label="추천 검색어">
        <span>이런 검색은 어때요?</span>
        {['티셔츠', '포스터', '패턴'].map((q) => (
          <button
            key={q}
            type="button"
            disabled={!ready}
            onClick={() => {
              setDraft(q);
              onSearch(q);
            }}
          >
            {q}
            <ArrowUpRight size={12} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
