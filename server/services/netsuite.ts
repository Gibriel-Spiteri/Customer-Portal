import * as crypto from 'crypto';

interface NetSuiteConfig {
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
  baseUrl: string;
}

interface NetSuiteResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rateLimitRemaining?: number;
}

interface NetSuiteOrder {
  id: string;
  tranid: string;
  status: string;
  trandate: string;
  shipdate?: string;
  total: number;
  currency: string;
  entity: string;
  shipaddress?: any;
}

interface NetSuitePayment {
  id: string;
  tranid: string;
  amount: number;
  trandate: string;
  paymentmethod: string;
  checknum?: string;
  status: string;
  currency: string;
  customer: string;
}

interface NetSuiteCustomer {
  id: string;
  entityid: string;
  companyname?: string;
  firstname?: string;
  lastname?: string;
  email: string;
  creditlimit?: number;
  balance: number;
  currency: string;
}

interface NetSuiteEstimate {
  id: string;
  tranid: string;
  status: string;
  trandate: string;
  duedate?: string;
  total: number;
  currency: string;
  entity: string;
  item?: any[];
  memo?: string;
}

export class NetSuiteService {
  private config: NetSuiteConfig;
  private concurrentRequests = 0;
  private maxConcurrentRequests = 15; // Base tier limit

  constructor() {
    // Extract account number from NETSUITE_ACCOUNT_ID if it contains a full URL
    let accountId = process.env.NETSUITE_ACCOUNT_ID || "";
    const accountMatch = accountId.match(/(\d+)\.app\.netsuite\.com/);
    if (accountMatch) {
      accountId = accountMatch[1];
    }
    
    this.config = {
      accountId: accountId,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY || "",
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || "",
      tokenId: process.env.NETSUITE_TOKEN_ID || "",
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET || "",
      baseUrl: process.env.NETSUITE_BASE_URL || `https://${accountId}.suitetalk.api.netsuite.com`
    };

    // Adjust max concurrent requests based on tier
    const tierLevel = parseInt(process.env.NETSUITE_TIER || "1");
    const scpLicenses = parseInt(process.env.NETSUITE_SCP_LICENSES || "0");
    this.maxConcurrentRequests = (5 + tierLevel * 10) + (scpLicenses * 10);
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    retryCount = 0
  ): Promise<NetSuiteResponse<T>> {
    if (this.concurrentRequests >= this.maxConcurrentRequests) {
      // Wait for available slot
      await this.waitForAvailableSlot();
    }

    this.concurrentRequests++;

    try {
      const url = `${this.config.baseUrl}/services/rest/record/v1/${endpoint}`;
      
      // Generate OAuth 1.0a header for Token-Based Authentication
      const authHeader = this.generateOAuthHeader(method, url);
      
      const headers = {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Prefer': 'transient', // Avoid record locking
      };

      console.log('Making NetSuite API request:', {
        url,
        method,
        authHeader: authHeader.substring(0, 50) + '...' // Log partial auth header for debugging
      });

      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      const rateLimitRemaining = parseInt(response.headers.get('X-Rate-Limit-Remaining') || '0');

      if (response.status === 429) {
        // Rate limit exceeded
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(method, endpoint, data, retryCount + 1);
        }
        return {
          success: false,
          error: 'Rate limit exceeded after retries',
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          rateLimitRemaining,
        };
      }

      const responseData = await response.json();
      return {
        success: true,
        data: responseData,
        rateLimitRemaining,
      };
    } catch (error) {
      console.error('NetSuite API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.concurrentRequests--;
    }
  }

  private async waitForAvailableSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.concurrentRequests < this.maxConcurrentRequests) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  private generateOAuthHeader(method: string, url: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    const oauthParams = {
      oauth_consumer_key: this.config.consumerKey,
      oauth_token: this.config.tokenId,
      oauth_signature_method: 'HMAC-SHA256',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0'
    };

    // Create signature base string
    const paramString = Object.keys(oauthParams)
      .sort()
      .map(key => `${key}=${encodeURIComponent(oauthParams[key as keyof typeof oauthParams])}`)
      .join('&');
    
    const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    
    // Generate signature
    const signingKey = `${encodeURIComponent(this.config.consumerSecret)}&${encodeURIComponent(this.config.tokenSecret)}`;
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(signatureBase)
      .digest('base64');
    
    // Build OAuth header with realm
    const authHeader = 'OAuth ' + 
      `realm="${this.config.accountId}", ` +
      Object.keys(oauthParams)
        .map(key => `${key}="${encodeURIComponent(oauthParams[key as keyof typeof oauthParams])}"`)
        .concat(`oauth_signature="${encodeURIComponent(signature)}"`)
        .join(', ');
    
    return authHeader;
  }

  async getCustomer(customerId: string): Promise<NetSuiteResponse<NetSuiteCustomer>> {
    return this.makeRequest<NetSuiteCustomer>('GET', `customer/${customerId}`);
  }

  async searchCustomerByEmail(email: string): Promise<NetSuiteResponse<NetSuiteCustomer[]>> {
    console.log('Searching for customer with email:', email);
    const query = `email IS "${email}"`;
    return this.makeRequest<NetSuiteCustomer[]>('GET', `customer?q=${encodeURIComponent(query)}`);
  }

  async getCustomerOrders(customerId: string, limit = 50): Promise<NetSuiteResponse<NetSuiteOrder[]>> {
    const query = `q=entity IS ${customerId}&limit=${limit}&orderby=trandate DESC`;
    return this.makeRequest<NetSuiteOrder[]>('GET', `salesorder?${query}`);
  }

  async getCustomerPayments(customerId: string, limit = 50): Promise<NetSuiteResponse<NetSuitePayment[]>> {
    const query = `q=customer IS ${customerId}&limit=${limit}&orderby=trandate DESC`;
    return this.makeRequest<NetSuitePayment[]>('GET', `customerpayment?${query}`);
  }

  async getOrder(orderId: string): Promise<NetSuiteResponse<NetSuiteOrder>> {
    return this.makeRequest<NetSuiteOrder>('GET', `salesorder/${orderId}`);
  }

  async getPayment(paymentId: string): Promise<NetSuiteResponse<NetSuitePayment>> {
    return this.makeRequest<NetSuitePayment>('GET', `customerpayment/${paymentId}`);
  }

  async searchRecords(recordType: string, query: string): Promise<NetSuiteResponse<any[]>> {
    return this.makeRequest<any[]>('GET', `${recordType}?q=${encodeURIComponent(query)}`);
  }

  async getCustomerEstimates(customerId: string, limit = 50): Promise<NetSuiteResponse<NetSuiteEstimate[]>> {
    console.log('Fetching estimates for customer:', customerId);
    
    // Check if we have all required credentials
    if (!this.config.consumerKey || !this.config.consumerSecret || !this.config.tokenId || !this.config.tokenSecret) {
      console.log('NetSuite credentials not fully configured');
      return {
        success: false,
        error: 'NetSuite API credentials not configured. Please provide Consumer Key, Consumer Secret, Token ID, and Token Secret.'
      };
    }
    
    const query = `q=entity IS ${customerId}&limit=${limit}&orderby=trandate DESC`;
    return this.makeRequest<NetSuiteEstimate[]>('GET', `estimate?${query}`);
  }

  async getEstimate(estimateId: string): Promise<NetSuiteResponse<NetSuiteEstimate>> {
    return this.makeRequest<NetSuiteEstimate>('GET', `estimate/${estimateId}`);
  }

  getConcurrencyStatus() {
    return {
      current: this.concurrentRequests,
      max: this.maxConcurrentRequests,
      available: this.maxConcurrentRequests - this.concurrentRequests,
    };
  }
}

export const netsuiteService = new NetSuiteService();
