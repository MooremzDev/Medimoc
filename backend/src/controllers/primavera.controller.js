import { asyncHandler } from '../middleware/asyncHandler.js';

const primaveraModules = [
  { key: 'finance', name: 'Finanças', status: 'por configurar' },
  { key: 'inventory', name: 'Inventário', status: 'por configurar' },
  { key: 'sales', name: 'Vendas', status: 'por configurar' },
  { key: 'purchasing', name: 'Compras', status: 'por configurar' }
];

export const listPrimaveraModules = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: primaveraModules
  });
});
