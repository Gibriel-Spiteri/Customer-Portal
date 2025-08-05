import jwt from 'jsonwebtoken';
import { storage } from '../storage';

interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  accountId: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export class NetSuiteOAuth2Service {
  private config: OAuth2Config;

  constructor() {
    const accountId = this.extractAccountId(process.env.NETSUITE_ACCOUNT_ID || '');
    
    this.config = {
      clientId: process.env.NETSUITE_CLIENT_ID || '',
      clientSecret: process.env.NETSUITE_CLIENT_SECRET || '',
      accountId: accountId,
      redirectUri: `${process.env.BASE_URL || 'http://localhost:5000'}/auth/netsuite/callback`,
      authorizationUrl: `https://${accountId}.app.netsuite.com/app/login/oauth2/authorize.nl`,
      tokenUrl: `https://${accountId}.app.netsuite.com/app/login/oauth2/token.nl`,
      scope: 'rest_webservices'
    };
  }

  private extractAccountId(accountIdInput: string): string {
    if (accountIdInput.includes('://')) {
      const match = accountIdInput.match(/https?:\/\/(\d+)\.app\.netsuite\.com/);
      return match ? match[1] : accountIdInput;
    }
    return accountIdInput;
  }

  /**
   * Generate authorization URL with PKCE for enhanced security
   */
  generateAuthorizationUrl(): { url: string; state: string; codeVerifier: string } {
    const state = this.generateRandomString(32);
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const url = `${this.config.authorizationUrl}?${params.toString()}`;
    
    return { url, state, codeVerifier };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier
    });

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Get customer information using access token
   */
  async getCustomerInfo(accessToken: string): Promise<any> {
    // First, get the current user's information
    const userResponse = await fetch(`https://${this.config.accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/employee/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      // If employee endpoint fails, try customer endpoint
      const customerResponse = await fetch(`https://${this.config.accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/customer/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!customerResponse.ok) {
        throw new Error('Failed to get user information from NetSuite');
      }

      return customerResponse.json();
    }

    return userResponse.json();
  }

  /**
   * Store OAuth tokens for a user
   */
  async storeUserTokens(userId: string, tokens: TokenResponse): Promise<void> {
    // Store tokens securely - in production, encrypt these
    await storage.updateUser(userId, {
      netsuiteAccessToken: tokens.access_token,
      netsuiteRefreshToken: tokens.refresh_token,
      netsuiteTokenExpiry: new Date(Date.now() + (tokens.expires_in * 1000))
    });
  }

  /**
   * Get valid access token for a user (refresh if needed)
   */
  async getUserAccessToken(userId: string): Promise<string | null> {
    const user = await storage.getUser(userId);
    
    if (!user?.netsuiteAccessToken) {
      return null;
    }

    // Check if token is expired
    if (user.netsuiteTokenExpiry && new Date(user.netsuiteTokenExpiry) <= new Date()) {
      // Token expired, try to refresh
      if (user.netsuiteRefreshToken) {
        try {
          const newTokens = await this.refreshAccessToken(user.netsuiteRefreshToken);
          await this.storeUserTokens(userId, newTokens);
          return newTokens.access_token;
        } catch (error) {
          console.error('Failed to refresh token:', error);
          return null;
        }
      }
      return null;
    }

    return user.netsuiteAccessToken;
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateCodeChallenge(codeVerifier: string): string {
    // In production, use proper SHA256 hashing
    // For now, we'll use a base64url encoded version
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
  }
}

export const netsuiteAuth = new NetSuiteOAuth2Service();