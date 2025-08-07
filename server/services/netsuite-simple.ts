import crypto from 'crypto';

/**
 * Simple NetSuite REST API Client
 * Implements OAuth 1.0a authentication for NetSuite
 */
export class NetSuiteClient {
  private accountId: string;
  private consumerKey: string;
  private consumerSecret: string;
  private tokenId: string;
  private tokenSecret: string;
  private baseUrl: string;

  constructor() {
    // Extract account ID from environment variable
    this.accountId = this.extractAccountId(process.env.NETSUITE_ACCOUNT_ID || '');
    this.consumerKey = process.env.NETSUITE_CONSUMER_KEY || '';
    this.consumerSecret = process.env.NETSUITE_CONSUMER_SECRET || '';
    this.tokenId = process.env.NETSUITE_TOKEN_ID || '';
    this.tokenSecret = process.env.NETSUITE_TOKEN_SECRET || '';
    
    // Build base URL for NetSuite REST API
    this.baseUrl = `https://${this.accountId}.suitetalk.api.netsuite.com/services/rest`;
  }

  /**
   * Extract numeric account ID from various formats
   */
  private extractAccountId(accountId: string): string {
    // Remove all non-numeric characters
    const numericId = accountId.replace(/[^\d]/g, '');
    return numericId || '1212804'; // Default to known account ID if extraction fails
  }

  /**
   * Generate OAuth 1.0a signature for a request
   */
  private generateOAuthSignature(
    method: string,
    url: string,
    timestamp: string,
    nonce: string
  ): string {
    // OAuth parameters in alphabetical order
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA256',
      oauth_timestamp: timestamp,
      oauth_token: this.tokenId,
      oauth_version: '1.0'
    };

    // Create parameter string
    const paramString = Object.keys(oauthParams)
      .sort()
      .map(key => `${key}=${encodeURIComponent(oauthParams[key])}`)
      .join('&');

    // Create signature base string
    const signatureBase = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(paramString)
    ].join('&');

    // Generate signature
    const signingKey = `${this.consumerSecret}&${this.tokenSecret}`;
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(signatureBase)
      .digest('base64');

    return signature;
  }

  /**
   * Create OAuth authorization header
   */
  private createAuthHeader(method: string, url: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = this.generateOAuthSignature(method, url, timestamp, nonce);

    // Build authorization header
    const authParams = {
      realm: this.accountId,
      oauth_consumer_key: this.consumerKey,
      oauth_token: this.tokenId,
      oauth_signature_method: 'HMAC-SHA256',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
      oauth_signature: signature
    };

    return 'OAuth ' + Object.entries(authParams)
      .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
      .join(', ');
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    const url = `${this.baseUrl}/record/v1/metadata-catalog`;
    
    try {
      const authHeader = this.createAuthHeader('GET', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'NetSuite API connection successful',
          details: {
            status: response.status,
            recordTypes: data.items?.length || 0
          }
        };
      } else {
        const errorText = await response.text();
        let errorMessage = `API request failed with status ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.o?.errorDetails?.[0]?.detail || 
                        errorJson.title || 
                        errorMessage;
        } catch {
          // If not JSON, use the text directly
          errorMessage = errorText.substring(0, 200);
        }

        return {
          success: false,
          message: errorMessage,
          details: {
            status: response.status,
            authError: response.headers.get('www-authenticate')
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      };
    }
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return !!(
      this.accountId &&
      this.consumerKey &&
      this.consumerSecret &&
      this.tokenId &&
      this.tokenSecret
    );
  }

  /**
   * Get configuration status
   */
  getConfigStatus(): {
    configured: boolean;
    missing: string[];
  } {
    const missing: string[] = [];
    
    if (!this.accountId) missing.push('NETSUITE_ACCOUNT_ID');
    if (!this.consumerKey) missing.push('NETSUITE_CONSUMER_KEY');
    if (!this.consumerSecret) missing.push('NETSUITE_CONSUMER_SECRET');
    if (!this.tokenId) missing.push('NETSUITE_TOKEN_ID');
    if (!this.tokenSecret) missing.push('NETSUITE_TOKEN_SECRET');
    
    return {
      configured: missing.length === 0,
      missing
    };
  }
}

// Export singleton instance
export const netsuiteClient = new NetSuiteClient();