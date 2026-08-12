import { Router } from 'express';
import { getSalesDashboard, getVendorDocuments } from '../controllers/dashboard.controller.js';
import { validateQuery } from '../middleware/validateRequest.js';
import { salesDashboardQuerySchema, vendorDocumentsQuerySchema } from '../validators/dashboard.validator.js';

const router = Router();

router.get('/sales/vendor-documents', validateQuery(vendorDocumentsQuerySchema), getVendorDocuments);
router.get('/sales', validateQuery(salesDashboardQuerySchema), getSalesDashboard);

export default router;
