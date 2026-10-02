import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { env } from '../config/env.config.js';
import {
  InstagramProfile,
  InstagramMediaResponse,
  OAuthTokenResponse,
  LongLivedTokenResponse,
} from '../models/instagram-connection.model.js';

export class InstagramService {
  private static instance: InstagramService;

  private constructor() {}

  public static getInstance(): InstagramService {
    if (!InstagramService.instance) {
      InstagramService.instance = new InstagramService();
    }
    return InstagramService.instance;
  }

  /**
   * Helper to format and sanitize Meta API error messages.
   */
  private formatMetaError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<{ error?: { message?: string; type?: string; code?: number; error_subcode?: number } }>;
      const metaError = axiosErr.response?.data?.error;
      if (metaError?.message) {
        return new Error(`Meta API Error (${metaError.code || axiosErr.response?.status}): ${metaError.message}`);
      }
      return new Error(`HTTP Error (${axiosErr.response?.status || 'Network'}): ${axiosErr.message}`);
    }
    return error instanceof Error ? error : new Error('Unknown Instagram API error');
  }

  /**
   * Tests whether an access token is valid and active.
   */
  public async testConnection(accessToken: string): Promise<{
    valid: boolean;
    data?: InstagramProfile;
    error?: string;
  }> {
    if (!accessToken) {
      return { valid: false, error: 'No Instagram access token provided' };
    }

    try {
      const response = await axios.get<InstagramProfile>(`${env.INSTAGRAM_GRAPH_API_URL}/me`, {
        params: {
          fields: 'id,user_id,username,name,account_type,media_count',
          access_token: accessToken,
        },
        timeout: 10000,
      });

      return {
        valid: true,
        data: response.data,
      };
    } catch (err) {
      const formatted = this.formatMetaError(err);
      return {
        valid: false,
        error: formatted.message,
      };
    }
  }

  /**
   * Fetches the connected Instagram account profile.
   * Fields: id, user_id, username, name, account_type, profile_picture_url, media_count
   */
  public async getProfile(accessToken: string): Promise<InstagramProfile> {
    if (!accessToken) {
      throw new Error('Access token is missing. Please connect your Instagram account.');
    }

    try {
      const response = await axios.get<InstagramProfile>(`${env.INSTAGRAM_GRAPH_API_URL}/me`, {
        params: {
          fields: 'id,user_id,username,name,account_type,profile_picture_url,media_count',
          access_token: accessToken,
        },
        timeout: 10000,
      });

      return response.data;
    } catch (err) {
      throw this.formatMetaError(err);
    }
  }

  /**
   * Fetches the connected Instagram account's media items.
   * Fields: id, caption, media_type, media_url, permalink, thumbnail_url, timestamp, like_count, comments_count
   */
  public async getMedia(accessToken: string, limit: number = 20, after?: string): Promise<InstagramMediaResponse> {
    if (!accessToken) {
      throw new Error('Access token is missing. Please connect your Instagram account.');
    }

    try {
      const params: Record<string, string | number> = {
        fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
        limit,
        access_token: accessToken,
      };

      if (after) {
        params['after'] = after;
      }

      const response = await axios.get<InstagramMediaResponse>(`${env.INSTAGRAM_GRAPH_API_URL}/me/media`, {
        params,
        timeout: 10000,
      });

      return response.data;
    } catch (err) {
      throw this.formatMetaError(err);
    }
  }

  /**
   * Builds the Instagram Login OAuth authorization URL with CSRF state and permissions.
   * Permissions configured: instagram_business_basic, instagram_business_manage_messages, instagram_business_manage_comments
   */
  public buildAuthUrl(state: string): string {
    if (!env.INSTAGRAM_APP_ID) {
      throw new Error('INSTAGRAM_APP_ID is not configured in backend environment variables.');
    }

    const scope = env.INSTAGRAM_SCOPES;

    const params = new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID,
      redirect_uri: env.INSTAGRAM_REDIRECT_URI,
      response_type: 'code',
      scope: scope,
      state: state,
    });

    const baseUrl = env.INSTAGRAM_OAUTH_AUTHORIZE_URL || 'https://www.instagram.com/oauth/authorize';
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchanges an OAuth authorization code for a short-lived user access token.
   */
  public async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    if (!env.INSTAGRAM_APP_ID || !env.INSTAGRAM_APP_SECRET) {
      throw new Error('INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET is missing from server configuration.');
    }

    try {
      const formData = new URLSearchParams();
      formData.append('client_id', env.INSTAGRAM_APP_ID);
      formData.append('client_secret', env.INSTAGRAM_APP_SECRET);
      formData.append('grant_type', 'authorization_code');
      formData.append('redirect_uri', env.INSTAGRAM_REDIRECT_URI);
      formData.append('code', code);

      const response = await axios.post<OAuthTokenResponse>(env.INSTAGRAM_OAUTH_TOKEN_URL, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      });

      return response.data;
    } catch (err) {
      throw this.formatMetaError(err);
    }
  }

  /**
   * Exchanges a short-lived access token for a 60-day long-lived access token.
   */
  public async exchangeForLongLivedToken(shortLivedToken: string): Promise<LongLivedTokenResponse> {
    if (!env.INSTAGRAM_APP_SECRET) {
      throw new Error('INSTAGRAM_APP_SECRET is missing from server configuration.');
    }

    try {
      const response = await axios.get<LongLivedTokenResponse>(`${env.INSTAGRAM_GRAPH_API_URL}/access_token`, {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: env.INSTAGRAM_APP_SECRET,
          access_token: shortLivedToken,
        },
        timeout: 15000,
      });

      return response.data;
    } catch (err) {
      throw this.formatMetaError(err);
    }
  }

  /**
   * Refreshes a long-lived access token before it expires.
   */
  public async refreshLongLivedToken(longLivedToken: string): Promise<LongLivedTokenResponse> {
    try {
      const response = await axios.get<LongLivedTokenResponse>(`${env.INSTAGRAM_GRAPH_API_URL}/refresh_access_token`, {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: longLivedToken,
        },
        timeout: 15000,
      });

      return response.data;
    } catch (err) {
      throw this.formatMetaError(err);
    }
  }

  /**
   * Verifies incoming Meta Webhook SHA256 signature.
   */
  public verifyWebhookSignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    if (!env.INSTAGRAM_APP_SECRET) {
      // In development if app secret is not yet provided, log warning
      return true;
    }
    if (!signatureHeader) {
      return false;
    }

    const [algorithm, signature] = signatureHeader.split('=');
    if (algorithm !== 'sha256' || !signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.INSTAGRAM_APP_SECRET)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
  }
}

export const instagramService = InstagramService.getInstance();
