import { z } from 'zod';

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

const positiveInteger = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().positive().safe());
export const searchSchema = z
  .object({
    q: z.string().trim().min(1).max(100),
    sort: z.enum(['sim', 'date']).default('sim'),
    page: positiveInteger.default(1),
    pageSize: z
      .enum(['12', '20', '28', '40'])
      .transform((value) => Number(value) as PageSize),
  })
  .refine((params) => params.page <= Math.ceil(MAX_RESULTS / params.pageSize), {
    message: 'Page is outside the searchable range',
    path: ['page'],
  });

const remoteUrl = z.url().refine((value) => {
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
});
const imageUrl = z.union([
  remoteUrl,
  z.string().regex(/^\/demo\/[1-9]\d*\.svg$/),
]);
export const imageSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  thumbnail: imageUrl,
  original: imageUrl,
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
});
export const searchResponseSchema = z.object({
  items: z.array(imageSchema).max(40),
  total: z.number().int().min(0).max(MAX_RESULTS),
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
  const parsedPage = positiveInteger.safeParse(url.get('page') ?? '1');
  const page =
    parsedPage.success &&
    parsedPage.data <= Math.ceil(MAX_RESULTS / previousSize)
      ? parsedPage.data
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
