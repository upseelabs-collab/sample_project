import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.config.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';

export function createApp(): Express {
  const app = express();

  // 1. Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // Allows Angular dev server live reload
    })
  );

  // 2. CORS Configuration
  const allowedOrigins = [
    env.FRONTEND_URL,
    'http://localhost:4200',
    'http://127.0.0.1:4200',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Dev-friendly fallback
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // 3. Request Logging (exclude sensitive bodies)
  app.use(morgan('dev'));

  // 4. Body Parsing with rawBody preservation for Webhook Signature verification
  app.use(
    express.json({
      verify: (req: Request, res: Response, buf: Buffer) => {
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // 5. REST API Routes
  app.use('/api', apiRouter);

  // 6. 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // 7. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
