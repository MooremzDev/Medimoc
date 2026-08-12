import { z } from 'zod';

const optionalDateSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Use datas no formato AAAA-MM-DD.'
  }).optional()
);

const validateDateRange = (value) => {
  if (!value.startDate || !value.endDate) {
    return true;
  }

  return value.startDate <= value.endDate;
};

const dateRangeValidation = {
  message: 'A data inicial não pode ser posterior à data final.',
  path: ['startDate']
};

export const salesDashboardQuerySchema = z.object({
  startDate: optionalDateSchema,
  endDate: optionalDateSchema
}).strict().refine(validateDateRange, dateRangeValidation);

export const vendorDocumentsQuerySchema = z.object({
  vendorCode: z.string().trim().min(1).max(50),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  limit: z.coerce.number().int().positive().max(100).optional().default(12)
}).strict().refine(validateDateRange, dateRangeValidation);
