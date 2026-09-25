import { Suspense } from 'react';
import Link from 'next/link';
import { Layers2, Sparkles, ArrowUpRight } from 'lucide-react';
import { ImageExplorer, SearchSkeleton } from '@/widgets/image-explorer';

export function SearchPage() {
  return (
    <>
      <a href="#main" className="skip-link">
        본문으로 바로가기
      </a>
      <header className="site-header">
        <div className="page-container header-inner">
          <Link href="/" className="brand" aria-label="소재집 홈">
            <span className="brand-mark">
              <Layers2 size={23} aria-hidden="true" />
            </span>
            소재집
            <span className="brand-divider" />
            <span className="brand-subtitle">IMAGE LIBRARY</span>
          </Link>
          <span className="header-caption">
            작은 발견에서 시작되는 아이디어{' '}
            <ArrowUpRight size={14} aria-hidden="true" />
          </span>
        </div>
      </header>
      <main id="main" className="page-container" tabIndex={-1}>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-content">
            <p className="hero-eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              매일, 새로운 영감 한 조각
            </p>
            <h1 id="page-title">
              좋은 아이디어의 시작,
              <br />
              <span>마음에 드는 이미지</span>에서.
            </h1>
            <p className="hero-description">
              떠오른 생각을 검색하고, 다음 작업의 힌트를 발견하세요.
            </p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="art-orbit" />
            <div className="art-card art-card-back" />
            <div className="art-card art-card-front">
              <span className="art-shape" />
              <span className="art-caption">A LITTLE INSPIRATION.</span>
            </div>
            <span className="art-spark">✦</span>
            <span className="art-dot" />
          </div>
        </section>
        <Suspense
          fallback={
            <div className="initial-loading" role="status">
              <p>검색 화면을 준비하고 있어요.</p>
              <SearchSkeleton />
            </div>
          }
        >
          <ImageExplorer />
        </Suspense>
      </main>
      <footer className="site-footer page-container">
        <span>
          소재집<span className="footer-dot">·</span>작은 발견, 새로운 가능성
        </span>
        <span>Find your next inspiration.</span>
      </footer>
    </>
  );
}
