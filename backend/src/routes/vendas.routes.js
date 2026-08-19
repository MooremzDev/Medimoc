import { Router } from 'express';
import { getVendasDashboard } from '../controllers/vendas.controller.js';
import { validateQuery } from '../middleware/validateRequest.js';
import { vendasQuerySchema } from '../validators/vendas.validator.js';

const router = Router();

router.get('/', validateQuery(vendasQuerySchema), getVendasDashboard);

export default router;
