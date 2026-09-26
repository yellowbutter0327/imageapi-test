import 'server-only';
import { searchSchema } from '@/entities/image';
import { searchImages } from '@/entities/image/index.server';
import { SearchError } from '@/shared/api';
import { getSearchConfig } from '@/shared/config/index.server';

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const headers = { 'Cache-Control': 'no-store', 'X-Request-Id': requestId };
  try {
    const query = new URL(request.url).searchParams;
    const keys = ['q', 'sort', 'page', 'pageSize'];
    if (
      [...query.keys()].some((key) => !keys.includes(key)) ||
      keys.some((key) => query.getAll(key).length > 1)
    ) {
      throw new SearchError(
        '검색 조건이 올바르지 않아요.',
        400,
        'INVALID_INPUT',
      );
    }
    const parsed = searchSchema.safeParse(Object.fromEntries(query));
    if (!parsed.success)
      throw new SearchError(
        '검색어, 정렬 또는 페이지 범위를 확인해주세요.',
        400,
        'INVALID_INPUT',
      );
    const data = await searchImages(
      parsed.data,
      getSearchConfig(),
      request.signal,
    );
    return Response.json(data, { headers });
  } catch (error) {
    const known =
      error instanceof SearchError
        ? error
        : new SearchError('검색 중 문제가 발생했어요.', 500, 'INTERNAL_ERROR');
    return Response.json(
      { code: known.code, message: known.message, requestId },
      {
        status: known.status,
        headers: {
          ...headers,
          ...(known.retryAfter
            ? { 'Retry-After': String(known.retryAfter) }
            : {}),
        },
      },
    );
  }
}
