const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? 'Request failed.',
      response.status,
      payload?.error?.details
    );
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
