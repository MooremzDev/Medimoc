import dotenv from 'dotenv';

dotenv.config();

const parseNumber = (name, fallback) => {
  const value = process.env[name];

  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsed;
};

const parseBoolean = (name, fallback) => {
  const value = process.env[name];

  if (value === undefined || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const parseList = (name, fallback = []) => {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumber('PORT', 5000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? '1mb',
  maxSelectRows: parseNumber('MAX_SELECT_ROWS', 1000),
  primaveraSchema: process.env.PRIMAVERA_SCHEMA ?? 'dbo',
  salesDocumentTypes: parseList('SALES_DOCUMENT_TYPES', ['FA', 'VD', 'FAMR', 'VDMR', 'FA-MR', 'VD-MR', 'VD-NP', 'NC']),
  db: {
    server: process.env.DB_SERVER,
    instance: process.env.DB_INSTANCE,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseNumber('DB_PORT'),
    encrypt: parseBoolean('DB_ENCRYPT', false),
    trustServerCertificate: parseBoolean('DB_TRUST_SERVER_CERTIFICATE', true),
    connectionTimeout: parseNumber('DB_CONNECTION_TIMEOUT_MS', 15000),
    requestTimeout: parseNumber('DB_REQUEST_TIMEOUT_MS', 30000)
  }
};

export const isDevelopment = env.nodeEnv === 'development';

export const getMissingDatabaseVariables = () => {
  const missing = [];

  if (!env.db.server) missing.push('DB_SERVER');
  if (!env.db.database) missing.push('DB_DATABASE');
  if (!env.db.user) missing.push('DB_USER');
  if (!env.db.password) missing.push('DB_PASSWORD');
  if (!env.db.port && !env.db.instance) missing.push('DB_PORT or DB_INSTANCE');

  return missing;
};
