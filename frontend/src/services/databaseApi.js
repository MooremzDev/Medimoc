import { apiClient } from './apiClient.js';

const toQueryString = (params) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });

  return query.toString();
};

export const getHealth = () => apiClient.get('/health');

export const testDatabaseConnection = () => apiClient.get('/database/test');

export const getDatabaseTables = (params = {}) => {
  const query = toQueryString(params);
  return apiClient.get(`/database/tables${query ? `?${query}` : ''}`);
};

export const getDatabaseTableColumns = (params) => {
  const query = toQueryString(params);
  return apiClient.get(`/database/columns?${query}`);
};

export const getDatabaseTableRows = (params) => {
  const query = toQueryString(params);
  return apiClient.get(`/database/rows?${query}`);
};

export const executeSelectQuery = (payload) => apiClient.post('/database/select', payload);

export const getPrimaveraModules = () => apiClient.get('/primavera/modules');
