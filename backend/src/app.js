import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { requestLogger } from './middleware/requestLogger.js';
import routes from './routes/index.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

app.disable('x-powered-by');

app.use(helmet());
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(requestLogger);

if (!hasFrontendBuild) {
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: 'Medimoc API',
      docs: '/api'
    });
  });
}

app.use('/api', cors(corsOptions), routes);

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(frontendIndexPath);
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
