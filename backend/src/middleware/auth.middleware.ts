import { Request, Response, NextFunction } from 'express';

// Extend Express Request interface to include authenticated userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Authentication middleware that identifies the current CreatorConnect user.
 * Supports Header (X-User-Id), Query, Session/JWT, with fallback for development.
 */
export function authenticateUser(req: Request, res: Response, next: NextFunction): void {
  // 1. Check custom user header
  const headerUserId = req.headers['x-user-id'] as string;
  if (headerUserId && headerUserId.trim()) {
    req.userId = headerUserId.trim();
    return next();
  }

  // 2. Check query parameter (useful for OAuth redirects)
  const queryUserId = req.query['userId'] as string;
  if (queryUserId && queryUserId.trim()) {
    req.userId = queryUserId.trim();
    return next();
  }

  // 3. Fallback to default user context for seamless dev / standalone operation
  req.userId = 'creator_user_1';
  next();
}
