import { env, getMissingDatabaseVariables } from '../config/env.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { databaseService } from '../services/database.service.js';

export const testDatabaseConnection = asyncHandler(async (_req, res) => {
  const missing = getMissingDatabaseVariables();

  if (missing.length > 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'DB_CONFIG_INCOMPLETE',
        message: 'Database configuration is incomplete.',
        details: missing
      }
    });
    return;
  }

  const result = await databaseService.testConnection();

  res.json({
    success: true,
    data: {
      connected: true,
      databaseName: result.databaseName,
      checkedAt: new Date().toISOString()
    }
  });
});

export const executeSelectQuery = asyncHandler(async (req, res) => {
  const { query, parameters, maxRows } = req.validatedBody;
  const result = await databaseService.executeSelectQuery(query, parameters);
  const rowLimit = Math.min(maxRows ?? env.maxSelectRows, env.maxSelectRows);
  const rows = result.rows.slice(0, rowLimit);

  res.json({
    success: true,
    data: {
      columns: result.columns,
      rows,
      rowCount: result.rows.length,
      returnedRows: rows.length,
      maxRows: rowLimit,
      rowsAffected: result.rowsAffected
    }
  });
});

export const listDatabaseTables = asyncHandler(async (req, res) => {
  const tables = await databaseService.listTables(req.validatedQuery);

  res.json({
    success: true,
    data: {
      tables,
      tableCount: tables.length
    }
  });
});

export const getDatabaseTableColumns = asyncHandler(async (req, res) => {
  const { schemaName, tableName } = req.validatedQuery;
  const columns = await databaseService.getTableColumns(schemaName, tableName);

  res.json({
    success: true,
    data: {
      schemaName,
      tableName,
      columns,
      columnCount: columns.length
    }
  });
});

export const previewDatabaseTableRows = asyncHandler(async (req, res) => {
  const { schemaName, tableName, limit } = req.validatedQuery;
  const result = await databaseService.previewTableRows(schemaName, tableName, limit);

  res.json({
    success: true,
    data: {
      schemaName,
      tableName,
      columns: result.columns,
      rows: result.rows,
      returnedRows: result.rowCount,
      maxRows: limit
    }
  });
});
