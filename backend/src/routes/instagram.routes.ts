import { Router } from 'express';
import { instagramController } from '../controllers/instagram.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import { apiLimiter, authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply user identification to all routes except public webhook verification
router.use((req, res, next) => {
  if (req.path.startsWith('/webhook') || req.path === '/callback') {
    return next();
  }
  return authenticateUser(req, res, next);
});

// 1. Connection & Status (Safe public metadata)
router.get('/connection', apiLimiter, (req, res, next) => instagramController.getConnection(req, res, next));
router.get('/status', apiLimiter, (req, res, next) => instagramController.getStatus(req, res, next));

// 2. Profile & Media
router.get('/profile', apiLimiter, (req, res, next) => instagramController.getProfile(req, res, next));
router.get('/media', apiLimiter, (req, res, next) => instagramController.getMedia(req, res, next));

// 3. Token Test Diagnostics
router.get('/test', apiLimiter, (req, res, next) => instagramController.test(req, res, next));

// 4. OAuth Registration Flow & Diagnostics
router.get('/oauth-debug', apiLimiter, (req, res) => instagramController.getOAuthDebug(req, res));
router.get('/auth', authLimiter, (req, res, next) => instagramController.getAuthUrl(req, res, next));
router.get('/callback', authLimiter, (req, res, next) => instagramController.handleCallback(req, res, next));

// 5. Disconnect Account
router.delete('/connection', apiLimiter, (req, res, next) => instagramController.disconnect(req, res, next));

// 6. Meta Webhooks
router.get('/webhook', (req, res) => instagramController.verifyWebhook(req, res));
router.post('/webhook', (req, res) => instagramController.handleWebhook(req, res));

export default router;
