import jwt from 'jsonwebtoken';

export interface NetSuiteCredentials {
  email: string;
  password: string;
  accountId: string;
}

export interface NetSuiteAuthResult {
  success: boolean;
  user?: any;
  error?: string;
}

export class NetSuiteDirectAuthService {
  private accountId: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.accountId = this.extractAccountId(process.env.NETSUITE_ACCOUNT_ID || '');
    this.clientId = process.env.NETSUITE_CLIENT_ID || '';
    this.clientSecret = process.env.NETSUITE_CLIENT_SECRET || '';
  }

  private extractAccountId(accountIdInput: string): string {
    if (accountIdInput.includes('://')) {
      const match = accountIdInput.match(/https?:\/\/(\d+)\.app\.netsuite\.com/);
      return match ? match[1] : accountIdInput;
    }
    return accountIdInput;
  }

  /**
   * Authenticate user with NetSuite using direct credentials
   * This simulates NetSuite authentication - in production, you'd use NetSuite's REST API
   */
  async authenticateUser(credentials: NetSuiteCredentials): Promise<NetSuiteAuthResult> {
    try {
      // For demo purposes, we'll validate credentials against demo data
      // In production, this would make actual API calls to NetSuite
      
      const isValidCredentials = await this.validateCredentials(credentials);
      
      if (!isValidCredentials) {
        return {
          success: false,
          error: 'Invalid NetSuite credentials. Please check your email and password.'
        };
      }

      // Simulate fetching customer data from NetSuite
      const customerData = await this.fetchCustomerData(credentials);
      
      return {
        success: true,
        user: customerData
      };

    } catch (error) {
      console.error('NetSuite authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed. Please try again or contact support.'
      };
    }
  }

  /**
   * Validate credentials against NetSuite
   * This accepts both demo credentials and real NetSuite user credentials
   */
  private async validateCredentials(credentials: NetSuiteCredentials): Promise<boolean> {
    try {
      console.log('Validating NetSuite credentials for:', credentials.email);

      // Demo credentials for testing
      const demoCredentials = [
        { email: 'customer@example.com', password: 'netsuite123' },
        { email: 'demo.customer@company.com', password: 'demo2024' },
        { email: 'test@netsuite.com', password: 'test123' }
      ];

      // Check against demo credentials first
      const isDemo = demoCredentials.some(cred => 
        cred.email === credentials.email && cred.password === credentials.password
      );

      if (isDemo) {
        console.log('Demo credentials validated successfully');
        return true;
      }

      // For real NetSuite credentials, we'll simulate validation
      // In a real implementation, you would make an API call to NetSuite here
      // For now, we accept any real-looking email/password combination
      
      const isValidFormat = credentials.email.includes('@') && 
                           credentials.email.includes('.') &&
                           credentials.password.length >= 6;

      if (!isValidFormat) {
        console.log('Invalid credential format');
        return false;
      }

      // TODO: In production, implement actual NetSuite API authentication here:
      /*
      const authUrl = `https://${this.accountId}.app.netsuite.com/app/login/oauth2/token`;
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'password',
          username: credentials.email,
          password: credentials.password,
          scope: 'rest_webservices'
        })
      });

      if (response.ok) {
        const authData = await response.json();
        console.log('NetSuite API authentication successful');
        return true;
      } else {
        console.log('NetSuite API authentication failed:', response.status);
        return false;
      }
      */

      // For development: Accept real-looking credentials
      console.log('Accepting real NetSuite credentials (simulated validation)');
      return true;

    } catch (error) {
      console.error('Credential validation error:', error);
      return false;
    }
  }

  /**
   * Fetch customer data from NetSuite after successful authentication
   */
  private async fetchCustomerData(credentials: NetSuiteCredentials): Promise<any> {
    // Simulate customer data from NetSuite
    // In production, this would fetch actual customer data via REST API
    
    return {
      id: `ns-${Date.now()}`,
      email: credentials.email,
      entityid: credentials.email,
      firstname: this.extractFirstName(credentials.email),
      lastname: 'Customer',
      companyname: 'NetSuite Customer',
      phone: '(555) 123-4567',
      accountNumber: `ACC-${this.accountId}-${Math.random().toString(36).substr(2, 6)}`,
      customerType: 'Premium',
      status: 'Active',
      territory: 'North America',
      salesRep: 'John Smith',
      creditLimit: 50000,
      terms: 'Net 30',
      taxExempt: false
    };
  }

  private extractFirstName(email: string): string {
    const localPart = email.split('@')[0];
    const parts = localPart.split('.');
    if (parts.length > 1) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }

  /**
   * Fetch customer orders from NetSuite
   */
  async fetchCustomerOrders(customerId: string): Promise<any[]> {
    // Simulate fetching orders from NetSuite
    return [
      {
        id: `order-${customerId}-1`,
        orderNumber: 'SO-2024-001',
        date: new Date().toISOString(),
        status: 'Shipped',
        total: 1250.00,
        items: [
          { sku: 'WIDGET-001', description: 'Premium Widget', quantity: 5, price: 250.00 }
        ]
      }
    ];
  }

  /**
   * Fetch customer invoices from NetSuite
   */
  async fetchCustomerInvoices(customerId: string): Promise<any[]> {
    // Simulate fetching invoices from NetSuite
    return [
      {
        id: `invoice-${customerId}-1`,
        invoiceNumber: 'INV-2024-001',
        date: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'Open',
        amount: 1250.00
      }
    ];
  }

  /**
   * Test NetSuite API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // In production, this would test the actual NetSuite API connection
      return this.accountId && this.clientId && this.clientSecret ? true : false;
    } catch (error) {
      return false;
    }
  }
}

export const netsuiteDirectAuth = new NetSuiteDirectAuthService();