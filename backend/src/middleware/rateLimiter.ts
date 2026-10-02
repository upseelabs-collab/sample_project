import rateLimit from 'express-rate-limit';

// Standard rate limiter for API endpoints (100 requests per 15 mins)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again later.',
  },
});

// Stricter rate limiter for OAuth and webhook endpoints (30 requests per 5 mins)
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication/webhook requests. Please wait a few minutes.',
  },
});
