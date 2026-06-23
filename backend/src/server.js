import app from './app.js';
import { env } from './config/env.js';
import { databaseService } from './services/database.service.js';
import { logger } from './utils/logger.js';

const server = app.listen(env.port, () => {
  logger.info('API server started', {
    environment: env.nodeEnv,
    port: env.port
  });
});

const shutdown = (signal) => {
  logger.info('Shutdown signal received', { signal });

  server.close(async () => {
    try {
      await databaseService.closePool();
    } catch (error) {
      logger.error('Failed to close SQL Server pool', {
        message: error.message
      });
    }

    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});
