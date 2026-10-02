export interface InstagramConnection {
  id: string;
  userId: string;
  instagramUserId: string;
  username: string;
  name?: string;
  profilePicture?: string;
  accountType?: string;
  mediaCount?: number;
  encryptedAccessToken: string;
  tokenType?: 'short_lived' | 'long_lived';
  tokenExpiresAt?: string | null;
  scopes?: string[];
  status: 'active' | 'expired' | 'revoked' | 'disconnected';
  connectedAt: string;
  updatedAt: string;
}

/**
 * Safe public connection object sent to frontend (NEVER contains tokens or secrets)
 */
export interface SafeInstagramConnection {
  id: string;
  userId: string;
  instagramUserId: string;
  username: string;
  name?: string;
  profilePicture?: string;
  accountType?: string;
  mediaCount?: number;
  scopes?: string[];
  status: 'active' | 'expired' | 'revoked' | 'disconnected';
  connectedAt: string;
  updatedAt: string;
}

export interface InstagramProfile {
  id: string;
  user_id?: string;
  username: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
  media_count?: number;
}

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramMediaResponse {
  data: InstagramMediaItem[];
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
  };
}

export interface OAuthTokenResponse {
  access_token: string;
  user_id: string;
  permissions?: string[];
}

export interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}
