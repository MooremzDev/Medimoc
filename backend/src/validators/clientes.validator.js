import { z } from 'zod';

export const clientesQuerySchema = z.object({
  segment: z.enum(['total', 'active', 'attention', 'risk', 'highRisk']).optional().default('total'),
  limit: z.coerce.number().int().positive().max(500).optional(),
  page: z.coerce.number().int().positive().max(1000).optional().default(1),
  pageSize: z.coerce.number().int().positive().max(50).optional()
}).strict();
