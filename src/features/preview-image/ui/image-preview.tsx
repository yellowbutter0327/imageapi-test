'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { ArrowUpRight, ImageOff, X } from 'lucide-react';
import type { ImageItem } from '@/entities/image';
import { Button } from '@/shared/ui';

export function ImagePreview({
  image,
  onClose,
  returnFocus,
}: {
  image: ImageItem | null;
  onClose: () => void;
  returnFocus: () => void;
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
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus();
          }}
        >
          {image && <PreviewContent key={image.id} image={image} />}
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

function PreviewContent({ image }: { image: ImageItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <div className="preview-image">
        {failed ? (
          <span className="image-fallback">
            <ImageOff aria-hidden="true" />
            이미지를 불러올 수 없어요
          </span>
        ) : (
          <Image
            src={image.thumbnail}
            alt={image.title}
            fill
            unoptimized
            sizes="(max-width: 768px) 90vw, 700px"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <div className="preview-info">
        <span className="eyebrow">IMAGE DETAIL</span>
        <Dialog.Title>{image.title}</Dialog.Title>
        <Dialog.Description>
          {image.width} × {image.height} ·{' '}
          {image.original.startsWith('/demo/')
            ? '직접 제작한 데모 샘플'
            : '외부 이미지'}
        </Dialog.Description>
        <a
          href={image.original}
          target="_blank"
          rel="noopener noreferrer"
          className="button button-primary"
        >
          원본 이미지 열기
          <ArrowUpRight size={17} aria-hidden="true" />
          <span className="sr-only"> (새 창)</span>
        </a>
      </div>
    </>
  );
}
