import * as openidClient from 'openid-client';
import { Request, Response } from 'express';

interface OIDCConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

class NetSuiteOIDCService {
  private client: any = null;
  private config: OIDCConfig;
  private issuer: any;
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
      this.issuer = await openidClient.Issuer.discover('https://1212804.suitetalk.api.netsuite.com/.well-known/openid-configuration');
      
      console.log('NetSuite OIDC Issuer discovered:', {
        issuer: this.issuer.issuer,
        authorizationEndpoint: this.issuer.authorization_endpoint,
        tokenEndpoint: this.issuer.token_endpoint
      });

      // Create OIDC client
      this.client = new this.issuer.Client({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uris: [this.config.redirectUri],
        response_types: ['code']
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
    const codeVerifier = openidClient.generators.codeVerifier();
    const codeChallenge = openidClient.generators.codeChallenge(codeVerifier);
    
    // Generate state for CSRF protection
    const state = openidClient.generators.state();
    
    // Store verifier and state in session
    req.session.oidc = {
      codeVerifier,
      state
    };

    // Generate authorization URL
    const authUrl = this.client.authorizationUrl({
      scope: this.config.scope,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state
    });

    return authUrl;
  }

  async handleCallback(req: Request): Promise<any> {
    await this.initialize();

    const params = this.client.callbackParams(req);
    
    // Verify state
    if (!req.session.oidc || params.state !== req.session.oidc.state) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    // Exchange code for tokens
    const tokenSet = await this.client.callback(
      this.config.redirectUri,
      params,
      {
        code_verifier: req.session.oidc.codeVerifier,
        state: req.session.oidc.state
      }
    );

    // Get user info
    const userinfo = await this.client.userinfo(tokenSet);

    // Clean up session
    delete req.session.oidc;

    return {
      tokenSet,
      userinfo
    };
  }

  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret);
  }

  getConfigStatus() {
    return {
      configured: this.isConfigured(),
      clientId: this.config.clientId ? 'Set' : 'Not set',
      clientSecret: this.config.clientSecret ? 'Set' : 'Not set',
      redirectUri: this.config.redirectUri,
      scope: this.config.scope
    };
  }
}

export const netsuiteOIDC = new NetSuiteOIDCService();