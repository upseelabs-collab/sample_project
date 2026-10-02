import { Router } from 'express';
import instagramRoutes from './instagram.routes.js';

const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'CreatorConnect API',
    timestamp: new Date().toISOString(),
  });
});

// Instagram API Module
apiRouter.use('/instagram', instagramRoutes);

export default apiRouter;
