import { Router } from 'express';
import {
  executeSelectQuery,
  getDatabaseTableColumns,
  listDatabaseTables,
  previewDatabaseTableRows,
  testDatabaseConnection
} from '../controllers/database.controller.js';
import { validateBody, validateQuery } from '../middleware/validateRequest.js';
import {
  selectQuerySchema,
  tableListQuerySchema,
  tableReferenceQuerySchema,
  tableRowsQuerySchema
} from '../validators/database.validator.js';

const router = Router();

router.get('/test', testDatabaseConnection);
router.get('/tables', validateQuery(tableListQuerySchema), listDatabaseTables);
router.get('/columns', validateQuery(tableReferenceQuerySchema), getDatabaseTableColumns);
router.get('/rows', validateQuery(tableRowsQuerySchema), previewDatabaseTableRows);
router.post('/select', validateBody(selectQuerySchema), executeSelectQuery);

export default router;
