import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/_app/providers';
import '@/_app/styles/globals.css';

export const metadata: Metadata = {
  title: '소재집 — 이미지로 시작하는 새로운 영감',
  description:
    '마음에 드는 이미지를 검색하고 다음 작업의 아이디어를 발견하세요.',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
