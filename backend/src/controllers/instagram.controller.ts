import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.config.js';
import { instagramService } from '../services/instagram.service.js';
import { storageService } from '../services/storage.service.js';

// Ephemeral in-memory store for OAuth CSRF state verification with TTL
interface OAuthStateEntry {
  createdAt: number;
  userId: string;
}
const stateStore = new Map<string, OAuthStateEntry>();

// Clean up expired states every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of stateStore.entries()) {
    if (now - val.createdAt > 15 * 60 * 1000) {
      stateStore.delete(key);
    }
  }
}, 15 * 60 * 1000);

export class InstagramController {
  /**
   * GET /api/instagram/auth
   * Initiates OAuth flow: creates secure CSRF state and redirects user to Meta Instagram login.
   */
  public async getAuthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!env.INSTAGRAM_APP_ID) {
        res.status(500).json({
          success: false,
          error: 'INSTAGRAM_APP_ID is not configured in backend environment.',
        });
        return;
      }

      const userId = req.userId || 'creator_user_1';
      const state = crypto.randomBytes(32).toString('hex');
      
      // Store state bound to the logged-in CreatorConnect user
      stateStore.set(state, {
        createdAt: Date.now(),
        userId,
      });

      const authUrl = instagramService.buildAuthUrl(state);

      // If user directly navigated or requested redirect, send 302 redirect to Meta
      if (req.query['redirect'] === 'true' || req.headers.accept?.includes('text/html')) {
        res.redirect(authUrl);
        return;
      }

      res.json({
        success: true,
        authUrl,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/instagram/callback
   * Handles OAuth callback from Meta, exchanges authorization code for tokens,
   * retrieves account details, registers connection, and redirects to Angular callback page.
   */
  public async handleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { code, state, error, error_reason, error_description } = req.query;

    // Handle user cancellation or Meta authorization errors
    if (error) {
      console.warn(`[Instagram OAuth] Authorization denied by user: ${error_reason} - ${error_description}`);
      const errorMsg = (error_description as string) || (error_reason as string) || 'Authentication request was denied.';
      res.redirect(`${env.FRONTEND_URL}/instagram/callback?success=false&error=${encodeURIComponent(errorMsg)}`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.redirect(`${env.FRONTEND_URL}/instagram/callback?success=false&error=${encodeURIComponent('Missing authorization code from Meta.')}`);
      return;
    }

    // Validate CSRF state
    if (!state || typeof state !== 'string' || !stateStore.has(state)) {
      console.warn('[Instagram OAuth] Invalid or expired CSRF state received');
      res.redirect(`${env.FRONTEND_URL}/instagram/callback?success=false&error=${encodeURIComponent('Security verification failed (invalid or expired state). Please try connecting again.')}`);
      return;
    }

    // State is valid: consume state to prevent replay attacks
    const stateData = stateStore.get(state)!;
    stateStore.delete(state);
    const userId = stateData.userId;

    try {
      // 1. Exchange OAuth code for short-lived access token
      const tokenData = await instagramService.exchangeCodeForToken(code);

      // 2. Exchange short-lived token for 60-day long-lived access token
      let accessToken = tokenData.access_token;
      let tokenType: 'short_lived' | 'long_lived' = 'short_lived';
      let tokenExpiresAt: string | null = null;

      try {
        const longLived = await instagramService.exchangeForLongLivedToken(accessToken);
        accessToken = longLived.access_token;
        tokenType = 'long_lived';
        if (longLived.expires_in) {
          tokenExpiresAt = new Date(Date.now() + longLived.expires_in * 1000).toISOString();
        }
      } catch (llErr) {
        console.warn('[Instagram OAuth] Long-lived token exchange notice, using initial token:', (llErr as Error).message);
      }

      // 3. Fetch Instagram account details
      const profile = await instagramService.getProfile(accessToken);

      // 4. Save/register encrypted connection in database for this specific user
      storageService.saveConnection({
        userId,
        instagramUserId: profile.id || profile.user_id || tokenData.user_id || 'unknown',
        username: profile.username || 'instagram_user',
        name: profile.name,
        profilePicture: profile.profile_picture_url,
        accountType: profile.account_type || 'BUSINESS',
        mediaCount: profile.media_count,
        accessToken,
        tokenType,
        tokenExpiresAt,
        scopes: tokenData.permissions || [
          'instagram_business_basic',
          'instagram_business_manage_messages',
          'instagram_business_manage_comments',
        ],
      });

      // 5. Redirect back to Angular frontend callback page
      res.redirect(`${env.FRONTEND_URL}/instagram/callback?success=true`);
    } catch (err) {
      console.error('[Instagram OAuth] Callback processing error:', (err as Error).message);
      const errMsg = (err as Error).message || 'Failed to complete Instagram connection.';
      res.redirect(`${env.FRONTEND_URL}/instagram/callback?success=false&error=${encodeURIComponent(errMsg)}`);
    }
  }

  /**
   * GET /api/instagram/connection
   * Returns safe public metadata for the user's connected Instagram account (NO tokens/secrets).
   */
  public async getConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId || 'creator_user_1';
      const safeConn = storageService.getSafeConnection(userId);

      if (!safeConn) {
        res.json({
          success: true,
          connected: false,
          data: null,
        });
        return;
      }

      res.json({
        success: true,
        connected: true,
        data: safeConn,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/instagram/status
   * Alias for connection check.
   */
  public async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    return this.getConnection(req, res, next);
  }

  /**
   * GET /api/instagram/profile
   * Retrieves live Instagram profile for the logged-in user.
   */
  public async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId || 'creator_user_1';
      const connection = storageService.getConnection(userId);

      if (!connection || !connection.accessToken) {
        res.status(400).json({
          success: false,
          error: 'Instagram account is not connected. Please connect your account first.',
        });
        return;
      }

      const profile = await instagramService.getProfile(connection.accessToken);

      // Update cached profile metadata
      storageService.saveConnection({
        userId,
        instagramUserId: profile.id || profile.user_id || connection.instagramUserId,
        username: profile.username || connection.username,
        name: profile.name || connection.name,
        profilePicture: profile.profile_picture_url || connection.profilePicture,
        accountType: profile.account_type || connection.accountType,
        mediaCount: profile.media_count !== undefined ? profile.media_count : connection.mediaCount,
        accessToken: connection.accessToken,
        tokenType: connection.tokenType,
        tokenExpiresAt: connection.tokenExpiresAt,
      });

      res.json({
        success: true,
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/instagram/media
   * Retrieves media items for the logged-in user's connected Instagram account.
   */
  public async getMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId || 'creator_user_1';
      const connection = storageService.getConnection(userId);

      if (!connection || !connection.accessToken) {
        res.status(400).json({
          success: false,
          error: 'Instagram account is not connected. Please connect your account first.',
        });
        return;
      }

      const limit = parseInt(req.query['limit'] as string, 10) || 20;
      const after = req.query['after'] as string | undefined;

      const media = await instagramService.getMedia(connection.accessToken, limit, after);

      res.json({
        success: true,
        data: media.data || [],
        paging: media.paging,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/instagram/connection
   * Disconnects the user's Instagram connection and removes credentials.
   */
  public async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId || 'creator_user_1';
      const deleted = storageService.deleteConnection(userId);

      res.json({
        success: true,
        message: deleted
          ? 'Instagram account disconnected and credentials wiped successfully.'
          : 'No active Instagram connection found to disconnect.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/instagram/test
   * Verifies the user's active token against Meta Graph API.
   */
  public async test(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId || 'creator_user_1';
      const connection = storageService.getConnection(userId);

      if (!connection || !connection.accessToken) {
        res.status(400).json({
          success: false,
          error: 'No active Instagram connection found. Please connect your account.',
        });
        return;
      }

      const result = await instagramService.testConnection(connection.accessToken);
      if (result.valid) {
        res.json({
          success: true,
          message: 'Instagram access token is valid and active!',
          data: result.data,
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error || 'Instagram access token verification failed',
        });
      }
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/instagram/webhook
   * Meta Webhook Verification Handshake
   */
  public async verifyWebhook(req: Request, res: Response): Promise<void> {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === env.INSTAGRAM_VERIFY_TOKEN) {
      console.log('[Meta Webhook] Verification successful');
      res.status(200).send(challenge);
      return;
    }

    res.status(403).json({ error: 'Webhook verification failed' });
  }

  /**
   * POST /api/instagram/webhook
   * Ingests live webhook notifications from Meta
   */
  public async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      const isValid = instagramService.verifyWebhookSignature(rawBody, signature);
      if (!isValid && process.env.NODE_ENV === 'production') {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const body = req.body;
      if (body.object === 'instagram' && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          const entryId = entry.id;
          const time = entry.time;
          if (Array.isArray(entry.messaging)) {
            for (const msg of entry.messaging) {
              console.log(`[Webhook Event] Messaging received for ${entryId} at ${time}`);
            }
          }
          if (Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              console.log(`[Webhook Event] Field ${change.field} changed for ${entryId}`);
            }
          }
        }
      }

      res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error('[Webhook Error]:', (err as Error).message);
      res.status(200).send('EVENT_RECEIVED');
    }
  }
}

export const instagramController = new InstagramController();
