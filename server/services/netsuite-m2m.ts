/**
 * NetSuite M2M (Machine-to-Machine) OAuth2 Service
 * Handles OAuth2 client credentials flow for server-to-server authentication
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SuiteQLResponse {
  items: any[];
  count: number;
  hasMore: boolean;
  offset: number;
  totalResults?: number;
  links?: any[];
}

export class NetSuiteM2M {
  private accountId: string;
  private consumerKey: string;
  private consumerSecret: string;
  private certificateId: string;
  private privateKey: string;
  private tokenUrl: string;
  private apiBaseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    // Extract account ID from full URL if provided as URL
    const rawAccountId = process.env.NETSUITE_ACCOUNT_ID || '1212804';
    
    // Check if it's a full URL and extract just the account ID
    if (rawAccountId.includes('.')) {
      // Extract account ID from URL like https://1212804.app.netsuite.com/
      const match = rawAccountId.match(/(?:https?:\/\/)?(\d+(?:_\w+)?)\./);
      this.accountId = match ? match[1] : rawAccountId;
    } else {
      this.accountId = rawAccountId;
    }
    
    this.consumerKey = process.env.NETSUITE_CONSUMER_KEY || '';
    this.consumerSecret = process.env.NETSUITE_CONSUMER_SECRET || '';
    this.certificateId = process.env.NETSUITE_CERTIFICATE_ID || '';
    
    // Try to read private key from file if not in environment
    if (process.env.NETSUITE_PRIVATE_KEY) {
      this.privateKey = process.env.NETSUITE_PRIVATE_KEY;
    } else {
      // Try to read from file
      try {
        const keyPath = path.join(process.cwd(), 'netsuite_private_key.pem');
        if (fs.existsSync(keyPath)) {
          this.privateKey = fs.readFileSync(keyPath, 'utf8');
          console.log('NetSuite M2M: Private key loaded from file');
        } else {
          this.privateKey = '';
          console.warn('NetSuite M2M: Private key file not found');
        }
      } catch (error) {
        console.error('NetSuite M2M: Error reading private key:', error);
        this.privateKey = '';
      }
    }
    
    // Replace underscores with hyphens in account ID for URL
    const accountIdForUrl = this.accountId.replace('_', '-').toLowerCase();
    this.tokenUrl = `https://${accountIdForUrl}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;
    this.apiBaseUrl = `https://${accountIdForUrl}.suitetalk.api.netsuite.com/services/rest`;
    
    console.log('NetSuite M2M: Using account ID:', this.accountId);
    console.log('NetSuite M2M: Token URL:', this.tokenUrl);
    
    if (!this.consumerKey || !this.consumerSecret) {
      console.warn('NetSuite M2M: Missing NETSUITE_CONSUMER_KEY or NETSUITE_CONSUMER_SECRET');
    }
    
    if (!this.privateKey) {
      console.warn('NetSuite M2M: Private key not configured - certificate-based auth will not work');
    }
  }

  /**
   * Generate JWT for client assertion
   */
  private generateClientAssertion(): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      iss: this.consumerKey,
      scope: 'rest_webservices',
      aud: this.tokenUrl,
      exp: now + 300, // 5 minutes expiry
      iat: now
    };

    console.log('NetSuite M2M: JWT payload:', JSON.stringify(payload, null, 2));
    console.log('NetSuite M2M: Using certificate ID:', this.certificateId);

    // NetSuite M2M requires RSA256 signing with a certificate
    if (this.privateKey) {      
      // Sign with RSA private key - use the actual certificate ID from NetSuite
      const token = jwt.sign(payload, this.privateKey, {
        algorithm: 'RS256',
        header: {
          typ: 'JWT',
          alg: 'RS256',
          kid: this.certificateId // Use the actual certificate ID from NetSuite
        }
      });
      
      console.log('NetSuite M2M: Generated JWT assertion (first 100 chars):', token.substring(0, 100) + '...');
      return token;
    } else {
      throw new Error('NetSuite M2M requires a private key for certificate-based authentication');
    }
  }

  /**
   * Get access token using OAuth2 client credentials flow
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const clientAssertion = this.generateClientAssertion();
      
      // Decode the JWT to verify its structure
      const [header, payload] = clientAssertion.split('.').slice(0, 2).map(part => 
        JSON.parse(Buffer.from(part, 'base64').toString())
      );
      
      console.log('NetSuite M2M: JWT Header:', JSON.stringify(header, null, 2));
      console.log('NetSuite M2M: JWT Payload decoded:', JSON.stringify(payload, null, 2));
      console.log('NetSuite M2M: Certificate ID in JWT:', header.kid);
      
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: clientAssertion
      });

      console.log('NetSuite M2M: Request parameters:');
      console.log('  grant_type:', 'client_credentials');
      console.log('  client_assertion_type:', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      console.log('  client_assertion length:', clientAssertion.length);
      console.log('NetSuite M2M: Requesting access token from:', this.tokenUrl);

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('NetSuite M2M: Token request failed:', response.status, errorText);
        
        // Try to parse error details
        try {
          const errorData = JSON.parse(errorText);
          console.error('NetSuite M2M: Error details:', errorData);
          if (errorData.error_description) {
            console.error('NetSuite M2M: Error description:', errorData.error_description);
          }
        } catch (e) {
          // If not JSON, just use the raw text
        }
        
        throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
      }

      const data: TokenResponse = await response.json();
      
      // Cache the token
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000); // Subtract 60 seconds for safety
      
      console.log('NetSuite M2M: Access token obtained, expires at:', this.tokenExpiry);
      
      return data.access_token;
    } catch (error) {
      console.error('NetSuite M2M: Error getting access token:', error);
      throw error;
    }
  }

  /**
   * Execute a SuiteQL query
   */
  async executeSuiteQL(query: string, limit: number = 100, offset: number = 0): Promise<SuiteQLResponse> {
    try {
      const accessToken = await this.getAccessToken();
      
      const url = `${this.apiBaseUrl}/query/v1/suiteql?limit=${limit}&offset=${offset}`;
      
      console.log('NetSuite M2M: Executing SuiteQL query:', query.substring(0, 100) + '...');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'transient'
        },
        body: JSON.stringify({ q: query })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('NetSuite M2M: SuiteQL query failed:', response.status, errorText);
        throw new Error(`SuiteQL query failed: ${response.status} ${errorText}`);
      }

      const data: SuiteQLResponse = await response.json();
      
      console.log(`NetSuite M2M: Query returned ${data.items.length} items`);
      
      return data;
    } catch (error) {
      console.error('NetSuite M2M: Error executing SuiteQL:', error);
      throw error;
    }
  }

  /**
   * Fetch estimates for a specific customer
   */
  async getCustomerEstimates(customerId: string, limit: number = 20): Promise<any[]> {
    const query = `
      SELECT 
        transaction.id,
        transaction.tranid AS documentNumber,
        transaction.trandate AS date,
        transaction.duedate AS expirationDate,
        transaction.status,
        transaction.total,
        transaction.subtotal,
        transaction.taxtotal AS tax,
        transaction.shippingcost AS shipping,
        transaction.memo,
        BUILTIN.DF(transaction.entity) AS customerName,
        BUILTIN.DF(transaction.location) AS location,
        BUILTIN.DF(transaction.currency) AS currency,
        transaction.exchangerate
      FROM 
        transaction
      WHERE 
        transaction.type = 'Estimate'
        AND transaction.entity = ${customerId}
      ORDER BY 
        transaction.trandate DESC
    `.trim();

    const result = await this.executeSuiteQL(query, limit, 0);
    return result.items;
  }

  /**
   * Fetch all estimates (for testing/admin purposes)
   */
  async getAllEstimates(limit: number = 20, offset: number = 0): Promise<SuiteQLResponse> {
    const query = `
      SELECT 
        transaction.id,
        transaction.tranid AS documentNumber,
        transaction.trandate AS date,
        transaction.duedate AS expirationDate,
        transaction.status,
        transaction.total,
        transaction.subtotal,
        transaction.taxtotal AS tax,
        transaction.shippingcost AS shipping,
        transaction.memo,
        BUILTIN.DF(transaction.entity) AS customerName,
        transaction.entity AS customerId,
        BUILTIN.DF(transaction.location) AS location,
        BUILTIN.DF(transaction.currency) AS currency,
        transaction.exchangerate,
        transaction.createddate,
        transaction.lastmodifieddate
      FROM 
        transaction
      WHERE 
        transaction.type = 'Estimate'
        AND transaction.mainline = 'T'
      ORDER BY 
        transaction.trandate DESC
    `.trim();

    return await this.executeSuiteQL(query, limit, offset);
  }

  /**
   * Fetch estimate details including line items
   */
  async getEstimateDetails(estimateId: string): Promise<any> {
    // Main estimate query
    const mainQuery = `
      SELECT 
        transaction.id,
        transaction.tranid AS documentNumber,
        transaction.trandate AS date,
        transaction.duedate AS expirationDate,
        transaction.status,
        transaction.total,
        transaction.subtotal,
        transaction.taxtotal AS tax,
        transaction.shippingcost AS shipping,
        transaction.memo,
        BUILTIN.DF(transaction.entity) AS customerName,
        transaction.entity AS customerId,
        BUILTIN.DF(transaction.location) AS location,
        BUILTIN.DF(transaction.currency) AS currency,
        transaction.exchangerate,
        transaction.createddate,
        transaction.lastmodifieddate,
        transaction.shipaddress AS shippingAddress,
        transaction.billaddress AS billingAddress
      FROM 
        transaction
      WHERE 
        transaction.type = 'Estimate'
        AND transaction.id = ${estimateId}
        AND transaction.mainline = 'T'
    `.trim();

    // Line items query
    const linesQuery = `
      SELECT 
        transactionline.id AS lineId,
        transactionline.line AS lineNumber,
        BUILTIN.DF(transactionline.item) AS itemName,
        transactionline.item AS itemId,
        transactionline.quantity,
        transactionline.rate,
        transactionline.amount,
        transactionline.description,
        transactionline.isclosed AS isClosed
      FROM 
        transactionline
      WHERE 
        transactionline.transaction = ${estimateId}
        AND transactionline.mainline = 'F'
      ORDER BY 
        transactionline.line
    `.trim();

    const [mainResult, linesResult] = await Promise.all([
      this.executeSuiteQL(mainQuery, 1, 0),
      this.executeSuiteQL(linesQuery, 100, 0)
    ]);

    if (mainResult.items.length === 0) {
      throw new Error(`Estimate ${estimateId} not found`);
    }

    return {
      ...mainResult.items[0],
      lineItems: linesResult.items
    };
  }

  /**
   * Test connection and configuration
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Test getting access token
      const token = await this.getAccessToken();
      
      // Test a simple SuiteQL query
      const testQuery = 'SELECT COUNT(*) as count FROM transaction WHERE transaction.type = \'Estimate\' AND ROWNUM <= 1';
      const result = await this.executeSuiteQL(testQuery, 1, 0);
      
      return {
        success: true,
        message: 'NetSuite M2M connection successful',
        details: {
          accountId: this.accountId,
          hasToken: !!token,
          testQueryResult: result.items[0]
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'NetSuite M2M connection failed',
        details: error instanceof Error ? error.message : error
      };
    }
  }
}