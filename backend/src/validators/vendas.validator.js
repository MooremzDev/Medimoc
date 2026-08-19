import { z } from 'zod';

const filterValueSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).max(128).optional()
);

export const vendasQuerySchema = z.object({
  period: z.enum(['day', 'month', 'year']).optional().default('month'),
  familyCode: filterValueSchema,
  productCode: filterValueSchema,
  vendorCode: filterValueSchema,
  brandCode: filterValueSchema,
  province: filterValueSchema,
  breakdownLimit: z.coerce.number().int().positive().max(50).optional().default(10),
  optionLimit: z.coerce.number().int().positive().max(500).optional().default(200)
}).strict();
