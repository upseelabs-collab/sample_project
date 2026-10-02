# CreatorConnect — Meta Instagram Graph API Integration

Full-stack production-ready integration between **Angular** frontend and **Node.js / Express (TypeScript)** backend connecting to Meta's official **Instagram Graph API (v22.0)**.

---

## Architecture Overview

```
d:/createconnect/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── env.config.ts           # Centralized environment variable loader & validator
│   │   ├── controllers/
│   │   │   └── instagram.controller.ts # Route handler (Test, Profile, Media, OAuth, Webhooks, Disconnect)
│   │   ├── middleware/
│   │   │   ├── error.middleware.ts     # Safe error handling (no secrets leaked)
│   │   │   └── rateLimiter.ts          # DDoS & brute-force rate limiters
│   │   ├── models/
│   │   │   └── instagram-connection.model.ts # TypeScript interfaces & DB schemas
│   │   ├── routes/
│   │   │   ├── index.ts                # Root API router (/api/health, /api/instagram)
│   │   │   └── instagram.routes.ts     # Instagram subrouter
│   │   ├── services/
│   │   │   ├── instagram.service.ts    # Meta Graph API v22.0 client & HMAC Webhook verifier
│   │   │   └── storage.service.ts      # AES-256 encrypted persistence layer with tester fallback
│   │   ├── app.ts                      # Express app with Helmet, CORS, and raw body preservation
│   │   └── server.ts                   # Server entrypoint
│   ├── .env.example                    # Environment variable template
│   ├── .gitignore
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   └── instagram-connect/  # Rich dark-mode UI with 4 states (Not connected, Loading, Connected, Error)
│   │   │   ├── models/
│   │   │   │   └── instagram.model.ts  # Frontend TypeScript interfaces
│   │   │   ├── services/
│   │   │   │   └── instagram.service.ts # Frontend REST API client
│   │   │   ├── app.config.ts           # Standalone Angular configuration (HttpClient, Router)
│   │   │   └── app.routes.ts           # Routing configuration
│   │   ├── environments/
│   │   │   ├── environment.ts          # API Base URL configuration
│   │   │   └── environment.prod.ts
│   │   ├── index.html
│   │   └── styles.css
│   ├── angular.json
│   └── package.json
├── package.json                        # Root workspace scripts
└── .gitignore
```

---

## 🚀 Quick Start Guide

### 1. Configure Backend Environment

Copy `.env.example` to `.env` in `backend/`:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your Meta Developer credentials:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200

# Meta Developer App Settings
INSTAGRAM_APP_ID=your_meta_app_id
INSTAGRAM_APP_SECRET=your_meta_app_secret

# For development testing with your Instagram Tester Token:
INSTAGRAM_ACCESS_TOKEN=your_generated_instagram_tester_access_token

# OAuth & Webhook Settings
INSTAGRAM_REDIRECT_URI=http://localhost:5000/api/instagram/callback
INSTAGRAM_VERIFY_TOKEN=creatorconnect_verify_token_secure_2026
INSTAGRAM_GRAPH_API_URL=https://graph.instagram.com/v22.0
```

### 2. Run Applications

From the root directory:

```bash
# Start both Backend and Frontend concurrently
npm run dev

# Or run individually:
npm run dev:backend   # Express API on http://localhost:5000
npm run dev:frontend  # Angular UI on http://localhost:4200
```

---

## 📡 Backend REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status check |
| `GET` | `/api/instagram/test` | Verifies active access token against Meta Graph API |
| `GET` | `/api/instagram/status` | Returns account connection status (no secrets exposed) |
| `GET` | `/api/instagram/profile` | Retrieves connected Instagram profile info |
| `GET` | `/api/instagram/media` | Retrieves Instagram media posts (images, reels, carousels) |
| `GET` | `/api/instagram/auth` | Generates secure Meta OAuth authorization URL with CSRF state |
| `GET` | `/api/instagram/callback`| OAuth code exchange handler, exchanges for 60-day token and stores connection |
| `DELETE` | `/api/instagram/connection` | Disconnects account and removes credentials |
| `GET` | `/api/instagram/webhook` | Meta Webhook verification handshake (`hub.challenge`) |
| `POST` | `/api/instagram/webhook` | Receives live webhook events with HMAC-SHA256 signature check |

---

## 🧪 Exact JSON Responses

### 1. `GET /api/instagram/test`
```json
{
  "success": true,
  "message": "Instagram access token is valid and active!",
  "data": {
    "id": "17841400000000000",
    "user_id": "17841400000000000",
    "username": "your_instagram_handle",
    "name": "Creator Name",
    "account_type": "BUSINESS",
    "media_count": 42
  }
}
```

### 2. `GET /api/instagram/profile`
```json
{
  "success": true,
  "data": {
    "id": "17841400000000000",
    "user_id": "17841400000000000",
    "username": "your_instagram_handle",
    "name": "Creator Name",
    "account_type": "BUSINESS",
    "profile_picture_url": "https://scontent.cdninstagram.com/v/...",
    "media_count": 42
  }
}
```

### 3. `GET /api/instagram/media`
```json
{
  "success": true,
  "data": [
    {
      "id": "18023456789012345",
      "caption": "Excited to launch CreatorConnect! #creator #build",
      "media_type": "IMAGE",
      "media_url": "https://scontent.cdninstagram.com/...",
      "permalink": "https://www.instagram.com/p/DB12345678/",
      "timestamp": "2026-09-28T14:30:00+0000",
      "like_count": 128,
      "comments_count": 14
    }
  ],
  "paging": {
    "cursors": {
      "after": "QVFIUkR..."
    }
  }
}
```

---

## 🔒 Security Implementation Details

1. **Zero Secret Leakage:** The Meta `App Secret` and `Access Token` are never returned in JSON responses or rendered into Angular template source.
2. **AES-256-GCM Token Encryption:** Access tokens are encrypted on disk in the storage layer using AES-256-GCM with SHA-256 key derivation.
3. **OAuth CSRF Mitigation:** Uses cryptographically secure random 24-byte hex state parameter with 15-minute TTL cache and single-use invalidation.
4. **Helmet & Security Headers:** Express applies Helmet security headers and strict Cross-Origin-Resource-Policy.
5. **Webhook Signature Verification:** Webhook payloads are verified against `X-Hub-Signature-256` using HMAC-SHA256.
6. **Rate Limiting:** Protects API and OAuth endpoints against abuse using `express-rate-limit`.

---

## ⚙️ Meta Developer Configuration & Production Checklist

### Development / Tester Phase (Current)
- Uses manually generated Instagram User Access Token or Tester Account OAuth.
- No Meta App Review required for users added as **Instagram Testers** in the Meta App Dashboard.

### Production Readiness Steps
1. **OAuth Redirect URI**: In Meta App Dashboard -> Instagram Settings -> Valid OAuth Redirect URIs, ensure `http://localhost:5000/api/instagram/callback` (or your production URL `https://api.yourdomain.com/api/instagram/callback`) is added.
2. **Meta App Review**: For non-tester public users to connect their Instagram accounts, submit the following permissions for Meta App Review:
   - `instagram_business_basic`
   - `instagram_business_manage_messages`
   - `instagram_business_manage_comments`
3. **Publish App**: Toggle the Meta App mode from **In Development** to **Live**.
4. **Webhooks Setup**: Configure Webhook URL `https://api.yourdomain.com/api/instagram/webhook` and verify token in Meta Webhooks Dashboard.
