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
    this.config = {
      accountId: process.env.NETSUITE_ACCOUNT_ID || "",
      consumerKey: process.env.NETSUITE_CONSUMER_KEY || "",
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || "",
      tokenId: process.env.NETSUITE_TOKEN_ID || "",
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET || "",
      baseUrl: process.env.NETSUITE_BASE_URL || `https://${process.env.NETSUITE_ACCOUNT_ID}.suitetalk.api.netsuite.com`,
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
      
      const headers = {
        'Authorization': this.generateOAuthHeader(method, url),
        'Content-Type': 'application/json',
        'Prefer': 'transient', // Avoid record locking
      };

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
    // This is a simplified OAuth 1.0 header generation
    // In production, use a proper OAuth library
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(36).substring(2, 15);
    
    const params = {
      oauth_consumer_key: this.config.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp.toString(),
      oauth_token: this.config.tokenId,
      oauth_version: '1.0',
    };

    // Generate signature (simplified - use proper OAuth library in production)
    const signature = this.generateSignature(method, url, params);
    
    return `OAuth realm="${this.config.accountId}", ` +
           `oauth_consumer_key="${params.oauth_consumer_key}", ` +
           `oauth_token="${params.oauth_token}", ` +
           `oauth_signature_method="${params.oauth_signature_method}", ` +
           `oauth_timestamp="${params.oauth_timestamp}", ` +
           `oauth_nonce="${params.oauth_nonce}", ` +
           `oauth_version="${params.oauth_version}", ` +
           `oauth_signature="${signature}"`;
  }

  private generateSignature(method: string, url: string, params: any): string {
    // Simplified signature generation
    // In production, implement proper HMAC-SHA1 signature
    const crypto = require('crypto');
    const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(Object.entries(params).map(([k, v]) => `${k}=${v}`).sort().join('&'))}`;
    const signingKey = `${encodeURIComponent(this.config.consumerSecret)}&${encodeURIComponent(this.config.tokenSecret)}`;
    return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  }

  async getCustomer(customerId: string): Promise<NetSuiteResponse<NetSuiteCustomer>> {
    return this.makeRequest<NetSuiteCustomer>('GET', `customer/${customerId}`);
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
