'use client';
import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { ArrowUpRight, ArrowLeft, ArrowRight, ImageOff, X } from 'lucide-react';
import type { ImageItem } from '@/entities/image';
import { Button } from '@/shared/ui';

export function ImagePreview({
  image,
  onClose,
  returnFocus,
  position,
  total,
  onPrevious,
  onNext,
}: {
  image: ImageItem | null;
  onClose: () => void;
  returnFocus: () => void;
  position: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <Dialog.Root
      open={image !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="image-dialog"
          onKeyDown={(event) => {
            if (
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey
            )
              return;
            if (event.key === 'ArrowLeft' && position > 1) {
              event.preventDefault();
              onPrevious();
            }
            if (event.key === 'ArrowRight' && position < total) {
              event.preventDefault();
              onNext();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus();
          }}
        >
          {image && (
            <PreviewContent image={image}>
              <nav
                className="preview-navigation"
                aria-label="미리보기 이미지 탐색"
              >
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="이전 이미지"
                  disabled={position <= 1}
                  onClick={onPrevious}
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </Button>
                <span role="status" aria-live="polite">
                  {position} / {total}
                </span>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="다음 이미지"
                  disabled={position >= total}
                  onClick={onNext}
                >
                  <ArrowRight size={18} aria-hidden="true" />
                </Button>
              </nav>
            </PreviewContent>
          )}
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="dialog-close"
              aria-label="미리보기 닫기"
            >
              <X size={22} aria-hidden="true" />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PreviewImage({ image }: { image: ImageItem }) {
  const [useThumbnail, setUseThumbnail] = useState(false);
  const [failed, setFailed] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const src = useThumbnail ? image.thumbnail : image.original;
  return (
    <div className="preview-image">
      {failed ? (
        <span className="image-fallback">
          <ImageOff aria-hidden="true" />
          이미지를 불러올 수 없어요
        </span>
      ) : (
        <Image
          key={src}
          src={src}
          alt={image.title}
          width={naturalSize?.width ?? (image.width || 640)}
          height={naturalSize?.height ?? (image.height || 480)}
          unoptimized
          loading="eager"
          className={naturalSize ? 'preview-loaded' : 'preview-loading'}
          referrerPolicy="no-referrer"
          onLoad={({ currentTarget }) =>
            setNaturalSize({
              width: currentTarget.naturalWidth,
              height: currentTarget.naturalHeight,
            })
          }
          onError={() => {
            if (!useThumbnail && image.original !== image.thumbnail) {
              setNaturalSize(null);
              setUseThumbnail(true);
            } else {
              setFailed(true);
            }
          }}
        />
      )}
      {!failed && !naturalSize && (
        <span className="preview-notice" aria-live="polite">
          이미지를 불러오는 중이에요.
        </span>
      )}
      {!failed && useThumbnail && naturalSize && (
        <span className="preview-notice" aria-live="polite">
          원본을 불러오지 못해 작은 미리보기로 표시했어요.
        </span>
      )}
    </div>
  );
}

function PreviewContent({
  image,
  children,
}: {
  image: ImageItem;
  children: ReactNode;
}) {
  return (
    <>
      <PreviewImage key={`${image.id}:${image.original}`} image={image} />
      <div className="preview-info">
        <div className="preview-caption">
          <Dialog.Title title={image.title}>{image.title}</Dialog.Title>
          <Dialog.Description>
            {image.width && image.height
              ? `${image.width} × ${image.height}`
              : '크기 정보 없음'}{' '}
            ·{' '}
            {image.original.startsWith('/demo/')
              ? '직접 제작한 데모 샘플'
              : '외부 이미지'}
          </Dialog.Description>
        </div>
        <div className="preview-actions">
          <a
            href={image.original}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-secondary preview-original"
          >
            원본 이미지 열기
            <ArrowUpRight size={17} aria-hidden="true" />
            <span className="sr-only"> (새 창)</span>
          </a>
          {children}
        </div>
      </div>
    </>
  );
}
