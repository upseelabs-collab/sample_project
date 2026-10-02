/**
 * Automated OAuth Diagnostic Test Script
 * Tests live backend Instagram OAuth URL generation and parameters.
 */
import https from 'https';
import http from 'http';
import { URL } from 'url';

const BACKEND_AUTH_URL = 'https://sample-project-jv5h.onrender.com/api/instagram/auth?redirect=true';
const EXPECTED_REDIRECT_URI = 'https://sample-project-jv5h.onrender.com/api/instagram/callback';

console.log('====================================================');
console.log('🔍 Running Instagram OAuth Diagnostic Test...');
console.log(`📡 Requesting: ${BACKEND_AUTH_URL}`);
console.log('====================================================\n');

function runDiagnostic() {
  const req = https.get(BACKEND_AUTH_URL, { headers: { Accept: 'text/html' } }, (res) => {
    console.log(`HTTP Status Code: ${res.statusCode} ${res.statusMessage}`);
    
    let targetOAuthUrl = '';

    if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 307) {
      targetOAuthUrl = res.headers.location || '';
      console.log('✓ Found 302 Location header from backend redirect.');
    } else {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.authUrl) {
            targetOAuthUrl = parsed.authUrl;
            console.log('✓ Found authUrl from backend JSON response.');
            validateOAuthUrl(targetOAuthUrl);
          } else {
            console.error('❌ FAIL: Backend did not return a Location header or authUrl field.');
            process.exit(1);
          }
        } catch (e) {
          console.error('❌ FAIL: Unexpected response body from backend:', body);
          process.exit(1);
        }
      });
      return;
    }

    validateOAuthUrl(targetOAuthUrl);
  });

  req.on('error', (err) => {
    console.error('❌ Network / Request Error:', err.message);
    process.exit(1);
  });
}

function validateOAuthUrl(rawUrl) {
  if (!rawUrl) {
    console.error('❌ FAIL: Authorization URL is empty.');
    process.exit(1);
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const params = parsedUrl.searchParams;

    const clientId = params.get('client_id');
    const redirectUri = params.get('redirect_uri');
    const responseType = params.get('response_type');
    const scope = params.get('scope');
    const state = params.get('state');

    console.log('--- OAuth URL Inspection ---');
    console.log(`OAuth Host:     ${parsedUrl.origin}`);
    console.log(`OAuth Path:     ${parsedUrl.pathname}`);
    console.log(`client_id:      ${clientId || '[MISSING]'}`);
    console.log(`redirect_uri:   ${redirectUri || '[MISSING]'}`);
    console.log(`response_type:  ${responseType || '[MISSING]'}`);
    console.log(`scope:          ${scope || '[MISSING]'}`);
    console.log(`state:          ${state ? '[PRESENT - 64-char CSRF]' : '[MISSING]'}`);
    console.log('----------------------------\n');

    let pass = true;

    // Check 1: Client ID present
    if (clientId && clientId.length > 0) {
      console.log('✓ [PASS] client_id is present');
    } else {
      console.log('❌ [FAIL] client_id is missing');
      pass = false;
    }

    // Check 2: Redirect URI present
    if (redirectUri && redirectUri.length > 0) {
      console.log('✓ [PASS] redirect_uri is present');
    } else {
      console.log('❌ [FAIL] redirect_uri is missing');
      pass = false;
    }

    // Check 3: Redirect URI exact match with expected production callback
    if (redirectUri === EXPECTED_REDIRECT_URI) {
      console.log(`✓ [PASS] redirect_uri matches production backend callback exactly: ${redirectUri}`);
    } else {
      console.log(`❌ [FAIL] redirect_uri mismatch! Expected: ${EXPECTED_REDIRECT_URI}, Got: ${redirectUri}`);
      pass = false;
    }

    // Check 4: response_type is 'code'
    if (responseType === 'code') {
      console.log('✓ [PASS] response_type is "code"');
    } else {
      console.log(`❌ [FAIL] response_type is "${responseType}", expected "code"`);
      pass = false;
    }

    // Check 5: Scopes contain required business scopes
    if (scope && scope.includes('instagram_business_basic')) {
      console.log('✓ [PASS] Required Instagram scopes configured');
    } else {
      console.log('❌ [FAIL] Scopes missing required instagram_business_basic');
      pass = false;
    }

    console.log('\n====================================================');
    if (pass) {
      console.log('🎉 OVERALL STATUS: ALL CHECKS PASSED');
    } else {
      console.log('⚠️ OVERALL STATUS: SOME CHECKS FAILED');
    }
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Failed to parse OAuth URL:', err.message);
    process.exit(1);
  }
}

runDiagnostic();
