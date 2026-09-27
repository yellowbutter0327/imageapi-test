import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { redisCommand } from '@/shared/api/index.server';
import { SearchError } from '@/shared/api';
import type { SearchConfig } from '@/shared/config/index.server';
import {
  searchResponseSchema,
  toSearchParams,
  type SearchParams,
} from '../model/search';
import { searchImages } from './search.server';

// Atomic across application instances. Count upstream attempts, including failures.
// Windows start at the first request and expire in Redis, independent of app clocks.
export const quotaScript = `
local minute = tonumber(redis.call('GET', KEYS[1]) or '0')
local day = tonumber(redis.call('GET', KEYS[2]) or '0')
if minute >= tonumber(ARGV[1]) then return math.max(1, redis.call('TTL', KEYS[1])) end
if day >= tonumber(ARGV[2]) then return math.max(1, redis.call('TTL', KEYS[2])) end
if redis.call('INCR', KEYS[1]) == 1 then redis.call('EXPIRE', KEYS[1], 60) end
if redis.call('INCR', KEYS[2]) == 1 then redis.call('EXPIRE', KEYS[2], 86400) end
return 0`;

export async function cachedSearchImages(
  params: SearchParams,
  config: SearchConfig,
  signal: AbortSignal,
) {
  if (config.mode === 'demo' || !config.store)
    return searchImages(params, config, signal);
  const namespace = createHash('sha256')
    .update(config.clientId)
    .digest('hex')
    .slice(0, 24);
  const condition = createHash('sha256')
    .update(toSearchParams(params).toString())
    .digest('hex');
  const key = `image-search:v1:${namespace}:${condition}`;
  const cached = await redisCommand(config.store, ['GET', key], signal);
  if (typeof cached === 'string') {
    try {
      const parsed = searchResponseSchema.safeParse(JSON.parse(cached));
      if (parsed.success && parsed.data.mode === 'live') return parsed.data;
    } catch {
      /* Ignore malformed cache entries and replace after a valid fetch. */
    }
  }
  const retryAfter = z
    .number()
    .int()
    .nonnegative()
    .parse(
      await redisCommand(
        config.store,
        [
          'EVAL',
          quotaScript,
          2,
          `image-search:{${namespace}}:minute`,
          `image-search:{${namespace}}:day`,
          config.perMinute,
          config.perDay,
        ],
        signal,
      ),
    );
  if (retryAfter)
    throw new SearchError(
      '검색 요청 한도에 도달했어요. 잠시 후 다시 시도해주세요.',
      429,
      'RATE_LIMITED',
      retryAfter,
    );
  const result = await searchImages(params, config, signal);
  // Only normalized successful responses are cached. A failed cache write must not
  // discard a valid search result; the already-consumed shared quota remains intact.
  try {
    await redisCommand(
      config.store,
      ['SET', key, JSON.stringify(result), 'EX', 60],
      signal,
    );
  } catch {
    /* Best-effort cache population. */
  }
  return result;
}
