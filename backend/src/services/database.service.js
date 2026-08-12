import sql from 'mssql';
import { env, getMissingDatabaseVariables } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const inferSqlType = (value) => {
  if (value === null) return sql.NVarChar;
  if (typeof value === 'boolean') return sql.Bit;
  if (typeof value === 'number' && Number.isInteger(value)) return sql.Int;
  if (typeof value === 'number') return sql.Float;
  return sql.NVarChar(sql.MAX);
};

const quoteIdentifier = (identifier) => `[${identifier.replace(/]/g, ']]')}]`;

class DatabaseService {
  pool = null;

  poolPromise = null;

  buildConfig() {
    const missing = getMissingDatabaseVariables();

    if (missing.length > 0) {
      throw new AppError('A configuração da base de dados está incompleta.', 400, 'DB_CONFIG_INCOMPLETE', missing);
    }

    const config = {
      server: env.db.server,
      database: env.db.database,
      user: env.db.user,
      password: env.db.password,
      connectionTimeout: env.db.connectionTimeout,
      requestTimeout: env.db.requestTimeout,
      options: {
        encrypt: env.db.encrypt,
        trustServerCertificate: env.db.trustServerCertificate,
        enableArithAbort: true
      }
    };

    if (env.db.port) {
      config.port = env.db.port;
    }

    if (env.db.instance && !env.db.port) {
      config.options.instanceName = env.db.instance;
    }

    return config;
  }

  async getPool() {
    if (this.pool?.connected) {
      return this.pool;
    }

    if (this.poolPromise) {
      return this.poolPromise;
    }

    const config = this.buildConfig();
    this.pool = new sql.ConnectionPool(config);

    this.pool.on('error', (error) => {
      logger.error('SQL Server pool error', {
        message: error.message
      });
      this.pool = null;
      this.poolPromise = null;
    });

    this.poolPromise = this.pool
      .connect()
      .then((pool) => {
        logger.info('Connected to SQL Server', {
          server: env.db.server,
          database: env.db.database
        });
        return pool;
      })
      .catch((error) => {
        this.pool = null;
        this.poolPromise = null;
        logger.error('SQL Server connection failed', {
          message: error.message
        });
        throw new AppError('Não foi possível ligar ao SQL Server.', 503, 'DB_CONNECTION_FAILED');
      });

    return this.poolPromise;
  }

  async testConnection() {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .query('SELECT 1 AS connected, DB_NAME() AS databaseName');

    return result.recordset[0];
  }

  async executeSelectQuery(query, parameters = {}) {
    const pool = await this.getPool();
    const request = pool.request();

    Object.entries(parameters).forEach(([name, value]) => {
      request.input(name, inferSqlType(value), value);
    });

    const result = await request.query(query);
    const rows = result.recordset ?? [];
    const columns = result.recordset?.columns ? Object.keys(result.recordset.columns) : Object.keys(rows[0] ?? {});

    return {
      columns,
      rows,
      rowsAffected: result.rowsAffected ?? []
    };
  }

  async listTables({ search = '', limit = 200 } = {}) {
    const pool = await this.getPool();
    const searchValue = search ? `%${search}%` : null;
    const result = await pool
      .request()
      .input('limit', sql.Int, limit)
      .input('search', sql.NVarChar(256), searchValue)
      .query(`
        SELECT TOP (@limit)
          s.name AS schemaName,
          t.name AS tableName,
          COALESCE(SUM(CASE WHEN p.index_id IN (0, 1) THEN p.rows ELSE 0 END), 0) AS [rowCount],
          t.create_date AS createdAt,
          t.modify_date AS modifiedAt
        FROM sys.tables t
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        LEFT JOIN sys.partitions p ON t.object_id = p.object_id
        WHERE (@search IS NULL OR s.name LIKE @search OR t.name LIKE @search)
        GROUP BY s.name, t.name, t.create_date, t.modify_date
        ORDER BY s.name, t.name
      `);

    return result.recordset ?? [];
  }

  async assertTableExists(schemaName, tableName) {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('schemaName', sql.NVarChar(128), schemaName)
      .input('tableName', sql.NVarChar(128), tableName)
      .query(`
        SELECT 1 AS found
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = @schemaName
          AND TABLE_NAME = @tableName
          AND TABLE_TYPE = 'BASE TABLE'
      `);

    if (!result.recordset?.length) {
      throw new AppError('Tabela não encontrada na base de dados configurada.', 404, 'TABLE_NOT_FOUND');
    }
  }

  async getTableColumns(schemaName, tableName) {
    await this.assertTableExists(schemaName, tableName);

    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('schemaName', sql.NVarChar(128), schemaName)
      .input('tableName', sql.NVarChar(128), tableName)
      .query(`
        SELECT
          COLUMN_NAME AS columnName,
          DATA_TYPE AS dataType,
          IS_NULLABLE AS isNullable,
          CHARACTER_MAXIMUM_LENGTH AS characterMaximumLength,
          NUMERIC_PRECISION AS numericPrecision,
          NUMERIC_SCALE AS numericScale,
          ORDINAL_POSITION AS ordinalPosition
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @schemaName
          AND TABLE_NAME = @tableName
        ORDER BY ORDINAL_POSITION
      `);

    return result.recordset ?? [];
  }

  async previewTableRows(schemaName, tableName, limit = 100) {
    await this.assertTableExists(schemaName, tableName);

    const pool = await this.getPool();
    const qualifiedTableName = `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
    const result = await pool
      .request()
      .input('limit', sql.Int, limit)
      .query(`SELECT TOP (@limit) * FROM ${qualifiedTableName}`);

    const rows = result.recordset ?? [];
    const columns = result.recordset?.columns ? Object.keys(result.recordset.columns) : Object.keys(rows[0] ?? {});

    return {
      columns,
      rows,
      rowCount: rows.length
    };
  }

  async closePool() {
    if (!this.pool) {
      return;
    }

    await this.pool.close();
    this.pool = null;
    this.poolPromise = null;
    logger.info('SQL Server pool closed');
  }
}

export const databaseService = new DatabaseService();
