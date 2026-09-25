import 'server-only';
import { z } from 'zod';
import { SearchError } from './search-error';

export type RedisConfig = { url: string; token: string };
const envelope = z.object({ result: z.unknown() });
export async function redisCommand(
  config: RedisConfig,
  command: (string | number)[],
  signal: AbortSignal,
) {
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
    });
    if (!response.ok) throw new Error('Storage unavailable');
    const data = envelope.parse(await response.json());
    if (!('result' in data)) throw new Error('Invalid storage response');
    return data.result;
  } catch {
    if (signal.aborted)
      throw new SearchError('취소된 검색입니다.', 499, 'CANCELLED');
    throw new SearchError(
      '검색 서비스를 잠시 사용할 수 없어요.',
      503,
      'STORAGE_UNAVAILABLE',
    );
  }
}
