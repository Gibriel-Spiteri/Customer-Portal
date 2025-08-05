import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';

export interface NetSuiteOAuthConfig {
  accountId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export class NetSuiteAuthService {
  private config: NetSuiteOAuthConfig;
  private baseUrl: string;
  private authUrl: string;

  constructor(config: NetSuiteOAuthConfig) {
    this.config = config;
    
    // Extract account ID from URL if full URL was provided
    let accountId = config.accountId;
    if (accountId.includes('://')) {
      const match = accountId.match(/https?:\/\/(\d+)\.app\.netsuite\.com/);
      if (match) {
        accountId = match[1];
      }
    }
    
    this.baseUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest`;
    this.authUrl = `https://${accountId}.app.netsuite.com/app/login/oauth2/authorize.nl`;
  }

  /**
   * Generate OAuth authorization URL for customer login
   */
  generateAuthorizationUrl(state?: string): { url: string; state: string; codeVerifier: string } {
    // Generate PKCE parameters for security
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const stateParam = state || this.generateState();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'rest_webservices',
      state: stateParam,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return {
      url: `${this.authUrl}?${params.toString()}`,
      state: stateParam,
      codeVerifier
    };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    authorizationCode: string, 
    codeVerifier: string
  ): Promise<TokenResponse> {
    const tokenUrl = `${this.baseUrl}/auth/oauth2/v1/token`;
    
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: this.config.redirectUri,
        code_verifier: codeVerifier
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const tokenUrl = `${this.baseUrl}/auth/oauth2/v1/token`;
    
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Make authenticated API request to NetSuite
   */
  async makeApiRequest(
    accessToken: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    const url = `${this.baseUrl}/${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Get customer information from NetSuite
   */
  async getCustomerInfo(accessToken: string): Promise<any> {
    try {
      // Get current user's customer record
      const response = await this.makeApiRequest(
        accessToken,
        'record/v1/customer',
        'GET'
      );
      
      return response;
    } catch (error) {
      console.error('Failed to get customer info:', error);
      throw error;
    }
  }

  /**
   * Validate access token by making a test API call
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.makeApiRequest(accessToken, 'record/v1/customer?limit=1');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Private helper methods
  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(codeVerifier: string): string {
    return createHash('sha256').update(codeVerifier).digest('base64url');
  }

  private generateState(): string {
    return randomBytes(16).toString('hex');
  }
}

// Export configured instance
export const netsuiteAuth = new NetSuiteAuthService({
  accountId: process.env.NETSUITE_ACCOUNT_ID || '',
  clientId: process.env.NETSUITE_CLIENT_ID || '',
  clientSecret: process.env.NETSUITE_CLIENT_SECRET || '',
  redirectUri: process.env.NETSUITE_REDIRECT_URI || 'http://localhost:5000/auth/netsuite/callback'
});