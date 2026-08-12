import { asyncHandler } from '../middleware/asyncHandler.js';
import { dashboardService } from '../services/dashboard.service.js';

export const getSalesDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getSalesSummary(req.validatedQuery);

  res.json({
    success: true,
    data
  });
});

export const getVendorDocuments = asyncHandler(async (req, res) => {
  const data = await dashboardService.getVendorDocuments(req.validatedQuery);

  res.json({
    success: true,
    data
  });
});
