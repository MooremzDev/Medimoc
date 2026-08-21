import { z } from 'zod';

export const clientesQuerySchema = z.object({
  segment: z.enum(['total', 'active', 'attention', 'risk', 'highRisk']).optional().default('total'),
  limit: z.coerce.number().int().positive().max(500).optional().default(200)
}).strict();
