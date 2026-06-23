import { asyncHandler } from '../middleware/asyncHandler.js';

export const getHealth = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    }
  });
});
