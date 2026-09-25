'use client';
import { useState } from 'react';
import Image from 'next/image';
import { ArrowUpRight, ImageOff } from 'lucide-react';
import type { ImageItem } from '../model/search';

export function ImageCard({
  image,
  priority,
  onSelect,
}: {
  image: ImageItem;
  priority: boolean;
  onSelect: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <li>
      <button
        type="button"
        className="image-card"
        onClick={onSelect}
        aria-label={`${image.title} 상세 보기`}
      >
        <span className="image-frame">
          {failed ? (
            <span className="image-fallback">
              <ImageOff size={26} aria-hidden="true" />
              이미지를 불러올 수 없어요
            </span>
          ) : (
            <Image
              src={image.thumbnail}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 1900px) 200px, (min-width: 1440px) 14vw, (min-width: 1200px) 20vw, (min-width: 768px) 25vw, 50vw"
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
          )}
          <span className="image-open" aria-hidden="true">
            <ArrowUpRight size={18} />
          </span>
        </span>
        <span className="image-title">{image.title}</span>
        <span className="image-meta">
          {image.width && image.height
            ? `${image.width} × ${image.height}`
            : '크기 정보 없음'}
          <span aria-hidden="true">이미지 ↗</span>
        </span>
      </button>
    </li>
  );
}
