import { Request, Response } from 'express';
import * as client from 'openid-client';

interface OIDCConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

class NetSuiteOIDCService {
  private config: OIDCConfig;
  private configuration: any = null;
  private initialized = false;

  constructor() {
    this.config = {
      clientId: process.env.NETSUITE_OIDC_CLIENT_ID || '',
      clientSecret: process.env.NETSUITE_OIDC_CLIENT_SECRET || '',
      redirectUri: process.env.NETSUITE_OIDC_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:5000'}/auth/netsuite/oidc/callback`,
      scope: 'openid email'
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Discover NetSuite OIDC configuration
      const discoveryUrl = new URL('https://1212804.suitetalk.api.netsuite.com/.well-known/openid-configuration');
      
      // For openid-client v6, discovery returns the configuration object directly
      this.configuration = await client.discovery(discoveryUrl, this.config.clientId, this.config.clientSecret);
      
      // Fetch the server metadata to log it
      const serverMetadata = await fetch(discoveryUrl.href).then(r => r.json());
      console.log('NetSuite OIDC Configuration discovered:', {
        issuer: serverMetadata.issuer,
        authorizationEndpoint: serverMetadata.authorization_endpoint,
        tokenEndpoint: serverMetadata.token_endpoint
      });

      this.initialized = true;
      console.log('NetSuite OIDC client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NetSuite OIDC:', error);
      throw error;
    }
  }

  async getAuthorizationUrl(req: Request): Promise<string> {
    await this.initialize();

    // Generate PKCE verifier and challenge
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    
    // Generate state for CSRF protection
    const state = client.randomState();
    
    // Store verifier and state in session
    req.session.oidc = {
      codeVerifier,
      state
    };

    // Build authorization URL
    const parameters = new URLSearchParams();
    parameters.set('client_id', this.config.clientId);
    parameters.set('redirect_uri', this.config.redirectUri);
    parameters.set('response_type', 'code');
    parameters.set('scope', this.config.scope);
    parameters.set('state', state);
    parameters.set('code_challenge', codeChallenge);
    parameters.set('code_challenge_method', 'S256');

    const authUrl = client.buildAuthorizationUrl(this.configuration, parameters);
    
    return authUrl.href;
  }

  async handleCallback(req: Request): Promise<any> {
    await this.initialize();

    const currentUrl = new URL(req.url, `http://${req.headers.host}`);
    const sessionOidc = req.session.oidc;

    if (!sessionOidc) {
      throw new Error('OIDC session data not found');
    }

    // Verify state
    const state = currentUrl.searchParams.get('state');
    if (state !== sessionOidc.state) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    // Exchange code for tokens
    const tokens = await client.authorizationCodeGrant(
      this.configuration,
      currentUrl,
      {
        pkceCodeVerifier: sessionOidc.codeVerifier,
        expectedState: sessionOidc.state
      }
    );

    // Get user info if we have an access token
    let userinfo: any = {};
    if (tokens.access_token) {
      try {
        // The subject is from the ID token, not tokens.claims()
        const subject = tokens.id_token ? JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString()).sub : undefined;
        userinfo = await client.fetchUserInfo(
          this.configuration,
          tokens.access_token,
          subject
        );
      } catch (error) {
        console.warn('Failed to fetch userinfo:', error);
        // Fallback to basic info from ID token if available
        if (tokens.id_token) {
          const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
          userinfo = {
            sub: payload.sub,
            email: payload.email,
            email_verified: payload.email_verified
          };
        }
      }
    }

    // Clean up session
    delete req.session.oidc;

    // Store tokens in session for API calls
    req.session.netsuiteTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: tokens.expires_at
    };

    return {
      userinfo,
      tokens
    };
  }

  async refreshTokens(refreshToken: string): Promise<any> {
    await this.initialize();
    
    const tokens = await client.refreshTokenGrant(
      this.configuration,
      refreshToken
    );
    
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: tokens.expires_at
    };
  }

  getStatus() {
    return {
      configured: !!(this.config.clientId && this.config.clientSecret),
      clientId: this.config.clientId ? 'Set' : 'Not set',
      clientSecret: this.config.clientSecret ? 'Set' : 'Not set',
      redirectUri: this.config.redirectUri,
      scope: this.config.scope
    };
  }
}

export const netsuiteOIDCService = new NetSuiteOIDCService();