import { Router } from 'express';
import clientesRoutes from './clientes.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import databaseRoutes from './database.routes.js';
import healthRoutes from './health.routes.js';
import primaveraRoutes from './primavera.routes.js';
import vendasRoutes from './vendas.routes.js';

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
        clientes: '/api/clientes',
        salesDashboard: '/api/dashboard/sales',
        salesVendorDocuments: '/api/dashboard/sales/vendor-documents',
        vendas: '/api/vendas',
        selectQuery: '/api/database/select',
        primaveraModules: '/api/primavera/modules'
      }
    }
  });
});

router.use('/health', healthRoutes);
router.use('/clientes', clientesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/database', databaseRoutes);
router.use('/primavera', primaveraRoutes);
router.use('/vendas', vendasRoutes);

export default router;
