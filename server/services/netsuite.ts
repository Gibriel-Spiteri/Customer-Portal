interface NetSuiteConfig {
  accountId: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  accessToken?: string;
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
      clientId: process.env.NETSUITE_CLIENT_ID || "",
      clientSecret: process.env.NETSUITE_CLIENT_SECRET || "",
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
      
      // For OAuth 2.0, we need to get an access token first
      const accessToken = await this.getAccessToken();
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
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

  private async getAccessToken(): Promise<string> {
    // If we already have a valid access token, return it
    if (this.config.accessToken) {
      return this.config.accessToken;
    }

    // For now, we'll simulate the OAuth 2.0 flow
    // In production, this would use the actual NetSuite OAuth 2.0 endpoint
    // with client credentials or authorization code flow
    
    try {
      // NetSuite OAuth 2.0 token endpoint
      const tokenUrl = `https://${this.config.accountId}.app.netsuite.com/app/login/oauth2/token`;
      
      // For direct authentication, we'd need to implement the full OAuth 2.0 flow
      // This is a placeholder - actual implementation would require:
      // 1. Authorization code flow with PKCE
      // 2. Or client credentials flow if available
      
      console.log('OAuth 2.0 authentication not fully implemented yet');
      console.log('Client ID:', this.config.clientId ? 'Present' : 'Missing');
      console.log('Client Secret:', this.config.clientSecret ? 'Present' : 'Missing');
      
      // Return empty token for now - this will cause API calls to fail
      // but with a clear error message
      return '';
      
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw new Error('OAuth 2.0 authentication failed');
    }
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
    console.log('Fetching estimates for customer:', customerId);
    
    // Check if we have OAuth credentials configured
    if (!this.config.clientId || !this.config.clientSecret) {
      console.log('OAuth credentials not configured, returning demo estimate data');
      // Return demo estimate for testing until OAuth is properly configured
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
          memo: 'Project estimate for Q1 2025 (Demo data - OAuth not configured)'
        }],
        rateLimitRemaining: 100
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
