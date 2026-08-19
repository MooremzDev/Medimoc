import { asyncHandler } from '../middleware/asyncHandler.js';
import { vendasService } from '../services/vendas.service.js';

export const getVendasDashboard = asyncHandler(async (req, res) => {
  const data = await vendasService.getVendasDashboard(req.validatedQuery);

  res.json({
    success: true,
    data
  });
});
