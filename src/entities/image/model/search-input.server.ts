import 'server-only';
import { z } from 'zod';
import { MAX_RESULTS, type PageSize } from './search';

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
