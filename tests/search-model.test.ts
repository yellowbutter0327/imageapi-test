import { searchSchema } from '@/entities/image/index.server';
import { describe, expect, it } from 'vitest';
import {
  imageSearchKey,
  pageSizeForWidth,
  readSearchParams,
  resizePage,
  searchResponseSchema,
  toSearchParams,
} from '@/entities/image';

describe('responsive search contract', () => {
  it('accepts local demo URLs without throwing in the remote URL validator', () => {
    const data = {
      mode: 'demo',
      total: 1,
      items: [
        {
          id: 'sample',
          title: '티셔츠',
          thumbnail: '/demo/1.svg',
          original: '/demo/1.svg',
          width: 480,
          height: 480,
        },
      ],
    };
    expect(searchResponseSchema.safeParse(data).success).toBe(true);
    expect(
      searchResponseSchema.safeParse({
        ...data,
        items: [{ ...data.items[0], original: 'not a URL' }],
      }).success,
    ).toBe(false);
  });
  it.each([
    [390, 12],
    [1199, 12],
    [1200, 20],
    [1439, 20],
    [1440, 28],
    [1899, 28],
    [1900, 40],
  ])('width %i uses %i images', (width, size) => {
    expect(pageSizeForWidth(width)).toBe(size);
  });
  it('keeps the previously first image inside the resized page', () => {
    expect(resizePage(3, 20, 28)).toBe(2);
    const params = readSearchParams(
      new URLSearchParams('q=포스터&sort=date&page=3&pageSize=20'),
      28,
    );
    expect(params).toEqual({
      q: '포스터',
      sort: 'date',
      page: 2,
      pageSize: 28,
    });
  });
  it('restores a legacy URL using the current viewport and normalizes malformed values', () => {
    expect(readSearchParams(new URLSearchParams('q=패턴&page=2'), 12)).toEqual({
      q: '패턴',
      sort: 'sim',
      page: 2,
      pageSize: 12,
    });
    expect(
      readSearchParams(
        new URLSearchParams('q= &sort=old&page=99999&pageSize=40'),
        20,
      ),
    ).toEqual({ q: '티셔츠', sort: 'sim', page: 1, pageSize: 20 });
  });
  it.each([
    'page=85&pageSize=12',
    'page=51&pageSize=20',
    'page=37&pageSize=28',
    'page=26&pageSize=40',
    'page=0&pageSize=12',
    'page=1&pageSize=24',
  ])('rejects invalid range %s', (query) => {
    expect(
      searchSchema.safeParse(
        Object.fromEntries(new URLSearchParams(`q=test&${query}`)),
      ).success,
    ).toBe(false);
  });
  it('includes every condition in the URL and cache key', () => {
    const params = {
      q: '티셔츠',
      sort: 'date' as const,
      page: 2,
      pageSize: 20 as const,
    };
    expect(readSearchParams(toSearchParams(params), 20)).toEqual(params);
    expect(imageSearchKey(params)).toEqual(['images', '티셔츠', 'date', 2, 20]);
    expect(imageSearchKey({ ...params, pageSize: 28 })).not.toEqual(
      imageSearchKey(params),
    );
  });
});
