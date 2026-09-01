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

export const vendasRankingQuerySchema = z.object({
  period: z.enum(['day', 'month', 'year']).optional().default('month'),
  dimension: z.enum(['vendors', 'products', 'brands']).optional().default('vendors'),
  familyCode: filterValueSchema,
  productCode: filterValueSchema,
  vendorCode: filterValueSchema,
  brandCode: filterValueSchema,
  province: filterValueSchema,
  page: z.coerce.number().int().positive().max(1000).optional().default(1),
  pageSize: z.coerce.number().int().positive().max(50).optional().default(10)
}).strict();
