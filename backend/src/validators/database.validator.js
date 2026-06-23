import { z } from 'zod';
import { env } from '../config/env.js';
import { isSafeSelectQuery } from '../utils/queryGuard.js';

const parameterNameSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, {
  message: 'Parameter names must contain only letters, numbers, and underscores, and cannot start with a number.'
});

const parameterValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null()
]);

export const selectQuerySchema = z.object({
  query: z.string().trim().min(1).max(10000).refine(isSafeSelectQuery, {
    message: 'Only single SELECT statements with named parameters are allowed.'
  }),
  parameters: z.record(parameterNameSchema, parameterValueSchema).default({}),
  maxRows: z.number().int().positive().max(env.maxSelectRows).optional()
}).strict();

const identifierSchema = z.string().trim().min(1).max(128);

export const tableListQuerySchema = z.object({
  search: z.string().trim().max(128).optional().default(''),
  limit: z.coerce.number().int().positive().max(500).optional().default(200)
}).strict();

export const tableReferenceQuerySchema = z.object({
  schemaName: identifierSchema,
  tableName: identifierSchema
}).strict();

export const tableRowsQuerySchema = tableReferenceQuerySchema.extend({
  limit: z.coerce.number().int().positive().max(env.maxSelectRows).optional().default(100)
}).strict();
