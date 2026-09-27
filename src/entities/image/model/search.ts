import * as z from 'zod/mini';

export const PAGE_SIZES = [12, 20, 28, 40] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const MAX_RESULTS = 1000;
export const DEFAULT_QUERY = '티셔츠';
export type Sort = 'sim' | 'date';
export type SearchParams = {
  q: string;
  sort: Sort;
  page: number;
  pageSize: PageSize;
};

const remoteUrl = z.url().check(
  z.refine((value) => {
    try {
      const url = new URL(value);
      return (
        ['https:', 'http:'].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }),
);
const imageUrl = z.union([
  remoteUrl,
  z.string().check(z.regex(/^\/demo\/[1-9]\d*\.svg$/)),
]);
export const imageSchema = z.object({
  id: z.string().check(z.minLength(1)),
  title: z.string(),
  thumbnail: imageUrl,
  original: imageUrl,
  width: z.int().check(z.nonnegative()),
  height: z.int().check(z.nonnegative()),
});
export const searchResponseSchema = z.object({
  items: z.array(imageSchema).check(z.maxLength(40)),
  total: z.int().check(z.minimum(0), z.maximum(MAX_RESULTS)),
  mode: z.enum(['demo', 'live']),
});
export type ImageItem = z.infer<typeof imageSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export function pageSizeForWidth(width: number): PageSize {
  return width >= 1900 ? 40 : width >= 1440 ? 28 : width >= 1200 ? 20 : 12;
}

export function resizePage(page: number, from: PageSize, to: PageSize) {
  return Math.floor(((page - 1) * from) / to) + 1;
}

export function readSearchParams(
  url: URLSearchParams,
  pageSize: PageSize,
): SearchParams {
  const parsedSize = Number(url.get('pageSize'));
  const previousSize =
    PAGE_SIZES.find((size) => size === parsedSize) ?? pageSize;
  const rawPage = url.get('page') ?? '1';
  const parsedPage = Number(rawPage);
  const page =
    /^[1-9]\d*$/.test(rawPage) &&
    Number.isSafeInteger(parsedPage) &&
    parsedPage <= Math.ceil(MAX_RESULTS / previousSize)
      ? parsedPage
      : 1;
  return {
    q: url.get('q')?.trim().slice(0, 100) || DEFAULT_QUERY,
    sort: url.get('sort') === 'date' ? 'date' : 'sim',
    page: resizePage(page, previousSize, pageSize),
    pageSize,
  };
}

export function toSearchParams(params: SearchParams) {
  return new URLSearchParams({
    q: params.q,
    sort: params.sort,
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
}

export function imageSearchKey(params: SearchParams) {
  return [
    'images',
    params.q,
    params.sort,
    params.page,
    params.pageSize,
  ] as const;
}
