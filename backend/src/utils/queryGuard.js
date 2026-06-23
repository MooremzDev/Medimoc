const blockedKeywords = [
  'alter',
  'backup',
  'create',
  'declare',
  'delete',
  'drop',
  'exec',
  'execute',
  'grant',
  'insert',
  'into',
  'merge',
  'opendatasource',
  'openquery',
  'openrowset',
  'restore',
  'revoke',
  'truncate',
  'update',
  'use',
  'xp_'
];

export const isSafeSelectQuery = (query) => {
  const trimmed = query.trim();
  const normalized = trimmed.replace(/\s+/g, ' ').toLowerCase();

  if (!/^select\b/.test(normalized)) {
    return false;
  }

  if (/[;]/.test(trimmed) || /--|\/\*|\*\//.test(trimmed)) {
    return false;
  }

  return !blockedKeywords.some((keyword) => {
    const pattern = keyword.endsWith('_') ? new RegExp(`\\b${keyword}`, 'i') : new RegExp(`\\b${keyword}\\b`, 'i');
    return pattern.test(normalized);
  });
};
