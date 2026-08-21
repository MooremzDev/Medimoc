import { asyncHandler } from '../middleware/asyncHandler.js';
import { clientesService } from '../services/clientes.service.js';

export const getClientesDashboard = asyncHandler(async (req, res) => {
  const data = await clientesService.getClientesDashboard(req.validatedQuery);

  res.json({
    success: true,
    data
  });
});
