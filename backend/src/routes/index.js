import { Router } from 'express';
import databaseRoutes from './database.routes.js';
import healthRoutes from './health.routes.js';
import primaveraRoutes from './primavera.routes.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Medimoc API',
      version: '0.1.0',
      endpoints: {
        health: '/api/health',
        databaseTest: '/api/database/test',
        databaseTables: '/api/database/tables',
        databaseColumns: '/api/database/columns',
        databaseRows: '/api/database/rows',
        selectQuery: '/api/database/select',
        primaveraModules: '/api/primavera/modules'
      }
    }
  });
});

router.use('/health', healthRoutes);
router.use('/database', databaseRoutes);
router.use('/primavera', primaveraRoutes);

export default router;
