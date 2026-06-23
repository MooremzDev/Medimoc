import { env } from './env.js';

const allowedOrigins = env.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const sameOriginHosts = new Set([
  `http://localhost:${env.port}`,
  `http://127.0.0.1:${env.port}`
]);

export const corsOptions = {
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      sameOriginHosts.has(origin)
    ) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};
