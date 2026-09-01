import { Router } from 'express';
import { getVendasDashboard, getVendasRanking } from '../controllers/vendas.controller.js';
import { validateQuery } from '../middleware/validateRequest.js';
import { vendasQuerySchema, vendasRankingQuerySchema } from '../validators/vendas.validator.js';

const router = Router();

router.get('/rankings', validateQuery(vendasRankingQuerySchema), getVendasRanking);
router.get('/', validateQuery(vendasQuerySchema), getVendasDashboard);

export default router;
