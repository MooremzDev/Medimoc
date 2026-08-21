import { Router } from 'express';
import { getClientesDashboard } from '../controllers/clientes.controller.js';
import { validateQuery } from '../middleware/validateRequest.js';
import { clientesQuerySchema } from '../validators/clientes.validator.js';

const router = Router();

router.get('/', validateQuery(clientesQuerySchema), getClientesDashboard);

export default router;
