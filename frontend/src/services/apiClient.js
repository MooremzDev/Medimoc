import { API_BASE_URL } from '../config/api.js';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    },
    ...options
  });

  const responseContentType = response.headers.get('content-type') ?? '';
  const payload = responseContentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? 'Pedido falhou.',
      response.status,
      payload?.error?.details
    );
  }

  if (!payload) {
    throw new ApiError('Resposta inválida da API. Confirme que o backend foi reiniciado.', response.status);
  }

  return payload;
};

export const apiClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, {
    method: 'POST',
    body: JSON.stringify(body)
  })
};
