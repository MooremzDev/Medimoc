import winston from 'winston';
import { env, isDevelopment } from '../config/env.js';

const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    const meta = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
    return `${timestamp} ${level}: ${message}${meta}`;
  })
);

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: env.logLevel,
  defaultMeta: {
    service: 'medimoc-api'
  },
  format: isDevelopment ? developmentFormat : productionFormat,
  transports: [new winston.transports.Console()]
});
