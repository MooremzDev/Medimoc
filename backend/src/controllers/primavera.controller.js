import { asyncHandler } from '../middleware/asyncHandler.js';

const primaveraModules = [
  { key: 'finance', name: 'Finance', status: 'placeholder' },
  { key: 'inventory', name: 'Inventory', status: 'placeholder' },
  { key: 'sales', name: 'Sales', status: 'placeholder' },
  { key: 'purchasing', name: 'Purchasing', status: 'placeholder' }
];

export const listPrimaveraModules = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: primaveraModules
  });
});
