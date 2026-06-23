import { Router } from 'express';
import { listPrimaveraModules } from '../controllers/primavera.controller.js';

const router = Router();

router.get('/modules', listPrimaveraModules);

export default router;
