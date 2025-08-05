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
    
    // Generate signature - NetSuite expects unencoded keys in the signing key
    const signingKey = `${this.config.consumerSecret}&${this.config.tokenSecret}`;
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
    console.log('Using demo data for customer');
    return {
      success: true,
      data: {
        id: customerId,
        entityid: 'DEMO-CUSTOMER',
        companyname: 'Demo Company',
        firstname: 'Demo',
        lastname: 'Customer',
        email: 'demo@customer.com',
        balance: 0,
        currency: 'USD'
      },
      rateLimitRemaining: 100
    };
  }

  async searchCustomerByEmail(email: string): Promise<NetSuiteResponse<NetSuiteCustomer[]>> {
    console.log('Using demo data for customer search');
    return {
      success: true,
      data: [{
        id: 'demo-customer-1',
        entityid: 'DEMO-CUSTOMER',
        companyname: 'Demo Company',
        firstname: 'Demo',
        lastname: 'Customer',
        email: email,
        balance: 0,
        currency: 'USD'
      }],
      rateLimitRemaining: 100
    };
  }

  async getCustomerOrders(customerId: string, limit = 50): Promise<NetSuiteResponse<NetSuiteOrder[]>> {
    console.log('Using demo data for orders');
    return {
      success: true,
      data: [],
      rateLimitRemaining: 100
    };
  }

  async getCustomerPayments(customerId: string, limit = 50): Promise<NetSuiteResponse<NetSuitePayment[]>> {
    console.log('Using demo data for payments');
    return {
      success: true,
      data: [],
      rateLimitRemaining: 100
    };
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
    
    // Return demo data - NetSuite integration disabled
    console.log('Using demo data for estimates');
    return {
      success: true,
      data: [{
        id: 'EST-001',
        tranid: 'EST-2025-001',
        status: 'Open',
        trandate: new Date().toISOString(),
        duedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        total: 25000,
        currency: 'USD',
        entity: customerId,
        item: [
          { name: 'Consulting Services', quantity: 40, rate: 500, amount: 20000 },
          { name: 'Implementation', quantity: 10, rate: 500, amount: 5000 }
        ],
        memo: 'Project estimate for Q1 2025 (Demo data)'
      }],
      rateLimitRemaining: 100
    };
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
