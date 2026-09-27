import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui';

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  return (
    <nav className="pagination" aria-label="검색 결과 페이지">
      <Button
        variant="ghost"
        size="icon"
        disabled={page <= 1}
        aria-label="이전 페이지"
        onClick={() => onChange(page - 1)}
      >
        <ArrowLeft size={18} aria-hidden="true" />
      </Button>
      {Array.from(
        { length: Math.min(5, totalPages) },
        (_, index) => first + index,
      ).map((number) => (
        <Button
          key={number}
          variant={page === number ? 'primary' : 'ghost'}
          size="icon"
          aria-label={`${number}페이지`}
          aria-current={page === number ? 'page' : undefined}
          onClick={() => onChange(number)}
        >
          {number}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="icon"
        disabled={page >= totalPages}
        aria-label="다음 페이지"
        onClick={() => onChange(page + 1)}
      >
        <ArrowRight size={18} aria-hidden="true" />
      </Button>
    </nav>
  );
}
