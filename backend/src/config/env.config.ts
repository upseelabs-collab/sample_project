import dotenv from 'dotenv';
import path from 'path';

// Load .env file from backend root
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:4200',
  
  // Instagram / Meta Developer Configuration
  INSTAGRAM_APP_ID: process.env.INSTAGRAM_APP_ID || '',
  INSTAGRAM_APP_SECRET: process.env.INSTAGRAM_APP_SECRET || '',
  INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN || '',
  INSTAGRAM_REDIRECT_URI: process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:5000/api/instagram/callback',
  INSTAGRAM_VERIFY_TOKEN: process.env.INSTAGRAM_VERIFY_TOKEN || 'creatorconnect_verify_token_secure_2026',

  // Meta Graph API Endpoints (v22.0)
  INSTAGRAM_GRAPH_API_URL: process.env.INSTAGRAM_GRAPH_API_URL || 'https://graph.instagram.com/v22.0',
  INSTAGRAM_OAUTH_AUTHORIZE_URL: 'https://www.instagram.com/oauth/authorize',
  INSTAGRAM_OAUTH_TOKEN_URL: 'https://api.instagram.com/oauth/access_token',
  
  // Storage Directory
  DATA_DIR: path.resolve(process.cwd(), 'data'),
};

// Validate critical configuration for warnings
export function checkConfigStatus() {
  const missing: string[] = [];
  if (!env.INSTAGRAM_APP_ID) missing.push('INSTAGRAM_APP_ID');
  if (!env.INSTAGRAM_APP_SECRET) missing.push('INSTAGRAM_APP_SECRET');
  if (!env.INSTAGRAM_ACCESS_TOKEN) missing.push('INSTAGRAM_ACCESS_TOKEN (Optional for tester mode, required for fallback test)');

  return {
    isConfigured: missing.length === 0,
    missing,
  };
}
