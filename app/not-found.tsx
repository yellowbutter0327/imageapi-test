import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="state-panel min-h-screen">
      <h1>페이지를 찾을 수 없어요.</h1>
      <p>주소를 확인하거나 이미지 검색으로 돌아가세요.</p>
      <Link href="/" className="button button-primary">
        이미지 검색으로
      </Link>
    </main>
  );
}
