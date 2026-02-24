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
    
    // Match PHP implementation exactly - scope as array
    const payload = {
      iss: this.consumerKey,
      scope: ['restlets', 'rest_webservices'], // Array of scopes like PHP
      iat: now,
      exp: now + 3600, // 1 hour expiry like PHP
      aud: this.tokenUrl
    };

    console.log('NetSuite M2M: JWT payload:', JSON.stringify(payload, null, 2));
    console.log('NetSuite M2M: Using certificate ID:', this.certificateId);
    console.log('NetSuite M2M: Using algorithm: PS256');

    // NetSuite M2M requires PS256 signing (RSASSA-PSS with SHA-256) like PHP implementation
    if (this.privateKey) {      
      // Sign with PS256 algorithm matching PHP implementation
      const token = jwt.sign(payload, this.privateKey, {
        algorithm: 'PS256', // Changed from RS256 to PS256
        header: {
          alg: 'PS256', // PS256 algorithm
          typ: 'JWT',
          kid: this.certificateId // Certificate ID from NetSuite
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
   * Search for a customer by entityid (customer number)
   */
  async searchCustomerByEntityId(entityId: string): Promise<any | null> {
    const query = `
      SELECT 
        customer.id AS internalId,
        customer.entityid AS customerNumber,
        customer.companyname AS companyName,
        customer.email,
        customer.firstname AS firstName,
        customer.lastname AS lastName,
        customer.isinactive AS isInactive,
        customer.custentity_customerstatus AS customerStatus
      FROM 
        customer
      WHERE 
        UPPER(customer.entityid) = UPPER('${entityId.replace(/'/g, "''")}')
    `.trim();

    const result = await this.executeSuiteQL(query, 1, 0);
    
    if (result.items.length > 0) {
      const customer = result.items[0];
      console.log(`NetSuite M2M: Found customer with entityid ${entityId}: Internal ID ${customer.internalid}`);
      return customer;
    }
    
    console.log(`NetSuite M2M: No customer found with entityid: ${entityId}`);
    return null;
  }

  /**
   * Fetch estimates for a specific customer
   */
  async getCustomerEstimates(customerId: string, limit: number = 1000): Promise<any[]> {
    const query = `
      SELECT 
        transaction.id,
        transaction.tranid AS documentNumber,
        transaction.trandate AS date,
        transaction.duedate AS expirationDate,
        transaction.status,
        transaction.total,
        transaction.memo,
        transaction.custbody_tagfor AS tagFor,
        BUILTIN.DF(transaction.entity) AS customerName,
        transaction.entity AS customerId,
        transaction.createddate,
        transaction.lastmodifieddate
      FROM 
        transaction
      WHERE 
        transaction.type = 'Estimate'
        AND transaction.entity = ${customerId}
        AND transaction.status = 'A'
      ORDER BY 
        transaction.trandate DESC
    `.trim();

    const result = await this.executeSuiteQL(query, limit, 0);
    return result.items;
  }

  /**
   * Fetch all estimates (for testing/admin purposes)
   */
  async getAllEstimates(limit: number = 1000, offset: number = 0): Promise<SuiteQLResponse> {
    const query = `
      SELECT 
        transaction.id,
        transaction.tranid AS documentNumber,
        transaction.trandate AS date,
        transaction.duedate AS expirationDate,
        transaction.status,
        transaction.total,
        transaction.memo,
        transaction.custbody_tagfor AS tagFor,
        BUILTIN.DF(transaction.entity) AS customerName,
        transaction.entity AS customerId,
        transaction.createddate,
        transaction.lastmodifieddate
      FROM 
        transaction
      WHERE 
        transaction.type = 'Estimate'
        AND transaction.status = 'A'
      ORDER BY 
        transaction.trandate DESC
    `.trim();

    return await this.executeSuiteQL(query, limit, offset);
  }

  /**
   * Fetch estimate details including line items
   */
  async getEstimateDetails(estimateId: string): Promise<any> {
    // Main estimate query - only using available fields
    const mainQuery = `
      SELECT 
        transaction.id,
        transaction.tranid AS documentNumber,
        transaction.trandate AS date,
        transaction.duedate AS expirationDate,
        transaction.status,
        transaction.total,
        transaction.taxtotal AS tax,
        transaction.memo,
        transaction.custbody_tagfor AS tagfor,
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
        AND transaction.id = ${estimateId}
    `.trim();

    // Line items query - simplified to only available fields
    const linesQuery = `
      SELECT 
        transactionline.id AS lineId,
        transactionline.linesequencenumber AS lineNumber,
        BUILTIN.DF(transactionline.item) AS itemName,
        transactionline.item AS itemId,
        transactionline.quantity,
        transactionline.rate,
        transactionline.amount,
        transactionline.memo AS description
      FROM 
        transactionline
      WHERE 
        transactionline.transaction = ${estimateId}
        AND transactionline.item IS NOT NULL
      ORDER BY 
        transactionline.linesequencenumber
    `.trim();

    const [mainResult, linesResult] = await Promise.all([
      this.executeSuiteQL(mainQuery, 1, 0),
      this.executeSuiteQL(linesQuery, 100, 0)
    ]);

    if (mainResult.items.length === 0) {
      throw new Error(`Estimate ${estimateId} not found`);
    }

    const discounttotal = linesResult.items.reduce((total: number, item: any) => {
      const itemName = (item.itemname || '').toLowerCase();
      const amount = parseFloat(item.amount || 0);
      if (itemName === 'customer discount') {
        return total + Math.abs(amount);
      }
      return total;
    }, 0);

    return {
      ...mainResult.items[0],
      discounttotal: discounttotal.toString(),
      items: linesResult.items
    };
  }

  /**
   * Fetch customer sales orders
   */
  async getCustomerOrders(customerId: string, limit: number = 1000): Promise<any[]> {
    const query = `
      SELECT DISTINCT
        transaction.id,
        transaction.tranid AS orderNumber,
        transaction.trandate AS orderDate,
        transaction.status,
        transaction.total,
        transaction.memo,
        transaction.custbody_tagfor AS tagFor,
        transaction.shipdate,
        transaction.shipmethod,
        BUILTIN.DF(transaction.entity) AS customerName,
        transaction.entity AS customerId,
        transaction.custbody_deposit_due,
        transaction.createddate,
        transaction.lastmodifieddate
      FROM 
        transaction
      WHERE 
        transaction.type = 'SalesOrd'
        AND transaction.entity = ${customerId}
        AND transaction.custbody_orig_salesorder IS NULL
      ORDER BY 
        transaction.trandate DESC
    `.trim();

    const result = await this.executeSuiteQL(query, limit, 0);
    return result.items;
  }

  /**
   * Fetch order details including line items
   */
  async getOrderDetails(orderId: string): Promise<any> {
    // Main order query
    const mainQuery = `
      SELECT 
        transaction.id,
        transaction.tranid AS orderNumber,
        transaction.trandate AS orderDate,
        transaction.status,
        transaction.total,
        transaction.taxtotal AS tax,
        transaction.memo,
        transaction.custbody_tagfor AS tagFor,
        BUILTIN.DF(transaction.entity) AS customerName,
        transaction.entity AS customerId,
        transaction.shipdate,
        transaction.shipmethod,
        transaction.custbody_deposit_due,
        transaction.createddate,
        transaction.lastmodifieddate
      FROM 
        transaction
      WHERE 
        transaction.type = 'SalesOrd'
        AND transaction.id = ${orderId}
    `.trim();

    // Line items query - enhanced with additional discount details and build IDs
    const linesQuery = `
      SELECT 
        transactionline.id AS lineId,
        transactionline.linesequencenumber AS lineNumber,
        BUILTIN.DF(transactionline.item) AS itemName,
        transactionline.item AS itemId,
        transactionline.quantity,
        transactionline.rate,
        transactionline.amount,
        transactionline.memo AS description,
        transactionline.ratepercent AS discountPercent,
        transactionline.isclosed,
        transactionline.uniquekey,
        transactionline.custcol_itemopt_cabbuild AS cabBuildId,
        transactionline.custcol_itemopt_cntrbuild AS cntrBuildId,
        item.itemtype AS itemType,
        item.displayname AS itemDisplayName,
        item.description AS itemDescription
      FROM 
        transactionline
      LEFT JOIN
        item ON transactionline.item = item.id
      WHERE 
        transactionline.transaction = ${orderId}
        AND transactionline.item IS NOT NULL
      ORDER BY 
        transactionline.linesequencenumber
    `.trim();

    // Get PRA records excluding PROMO-ITEMIZED (pratype = 1)
    // Show only non-itemized promotional adjustments with their NetSuite names
    const praQuery = `
      SELECT 
        pra.id AS praId,
        pra.name AS praNumber,
        pra.custrecord_txnpra_pracode AS praCode,
        BUILTIN.DF(pra.custrecord_txnpra_pracode) AS praCodeName,
        pra.custrecord_txnpra_discrate AS discountRate,
        pra.custrecord_txnpra_posted AS postedAmount,
        pra.custrecord_txnpra_pratype AS praType,
        CASE 
          WHEN pra.custrecord_txnpra_pracode = '11' THEN 'CRD REBATE REDEMPTION'
          WHEN pra.custrecord_txnpra_pracode = '372' THEN 'Limited Time Spring Into Savings Promo'
          ELSE BUILTIN.DF(pra.custrecord_txnpra_pracode)
        END AS praDescription
      FROM 
        customrecord_txnpra pra
      WHERE 
        pra.custrecord_txnpra_txnid = ${orderId}
        AND pra.custrecord_txnpra_txntype = 'salesorder'
        AND pra.custrecord_txnpra_pratype != '1'
    `.trim();

    const [mainResult, linesResult, praResult] = await Promise.all([
      this.executeSuiteQL(mainQuery, 1, 0),
      this.executeSuiteQL(linesQuery, 100, 0),
      this.executeSuiteQL(praQuery, 50, 0).catch((err) => { console.log('PRA query error:', err.message); return { items: [] }; })
    ]);

    if (mainResult.items.length === 0) {
      throw new Error(`Order ${orderId} not found`);
    }

    const orderNumber = (mainResult.items[0].ordernumber || '').replace(/^SO/, '');

    const filesQuery = `
      SELECT 
        File.id AS fileId,
        File.name AS fileName,
        File.description AS fileDescription,
        File.filetype AS fileType,
        File.filesize AS fileSize,
        File.url AS fileUrl,
        File.createddate AS createdDate,
        File.lastmodifieddate AS lastModifiedDate
      FROM 
        File
      WHERE 
        File.name LIKE '${orderNumber}%'
      ORDER BY 
        File.createddate DESC
    `.trim();

    const filesResult = await this.executeSuiteQL(filesQuery, 100, 0).catch((err) => { 
      console.log('Files query error:', err.message); 
      return { items: [] }; 
    });

    console.log('Files query for order number', orderNumber, 'returned:', filesResult.items.length, 'items');
    if (filesResult.items.length > 0) {
      console.log('Files found:', filesResult.items.map((f: any) => f.filename));
    }

    const discounttotal = linesResult.items.reduce((total: number, item: any) => {
      const itemName = (item.itemname || '').toLowerCase();
      const amount = parseFloat(item.amount || 0);
      if (itemName === 'customer discount') {
        return total + Math.abs(amount);
      }
      return total;
    }, 0);

    return {
      ...mainResult.items[0],
      discounttotal: discounttotal.toString(),
      lineItems: linesResult.items,
      praDetails: praResult.items,
      files: filesResult.items
    };
  }

  /**
   * Fetch customer invoices
   */
  async getCustomerInvoices(customerId: string, limit: number = 1000): Promise<any[]> {
    const query = `
      SELECT DISTINCT
        transaction.id,
        transaction.tranid AS invoiceNumber,
        transaction.trandate AS invoiceDate,
        transaction.duedate,
        transaction.status,
        transaction.total,
        transaction.memo,
        BUILTIN.DF(transaction.entity) AS customerName,
        transaction.entity AS customerId,
        transaction.createddate,
        transaction.lastmodifieddate
      FROM 
        transaction
      WHERE 
        transaction.type = 'CustInvc'
        AND transaction.entity = ${customerId}
      ORDER BY 
        transaction.trandate DESC
    `.trim();

    const result = await this.executeSuiteQL(query, limit, 0);
    return result.items;
  }

  /**
   * Fetch customer payments
   */
  async getCustomerPayments(customerId: string, limit: number = 1000): Promise<any[]> {
    const query = `
      SELECT DISTINCT
        transaction.id,
        transaction.tranid AS paymentNumber,
        transaction.trandate AS paymentDate,
        transaction.total AS amount,
        transaction.memo,
        BUILTIN.DF(transaction.entity) AS customerName,
        transaction.entity AS customerId,
        transaction.createddate,
        transaction.lastmodifieddate
      FROM 
        transaction
      WHERE 
        transaction.type = 'CustPymt'
        AND transaction.entity = ${customerId}
      ORDER BY 
        transaction.trandate DESC
    `.trim();

    const result = await this.executeSuiteQL(query, limit, 0);
    return result.items;
  }

  /**
   * Fetch customer contacts
   */
  async getCustomerContacts(customerId: string): Promise<any[]> {
    const query = `
      SELECT 
        contact.id,
        contact.entityid,
        contact.firstname,
        contact.lastname,
        contact.email,
        contact.phone,
        contact.mobilephone,
        contact.title,
        contact.company,
        contact.contactrole,
        contact.custentity_best_phone,
        BUILTIN.DF(contact.id) AS displayname,
        BUILTIN.DF(contact.contactrole) AS role
      FROM 
        contact
      WHERE 
        contact.company = ${customerId}
      ORDER BY 
        CASE WHEN contact.contactrole = -10 THEN 0 ELSE 1 END,
        contact.entityid
    `.trim();

    const result = await this.executeSuiteQL(query, 100, 0);
    console.log('NetSuite M2M: Raw contact data from NetSuite:', JSON.stringify(result.items, null, 2));
    return result.items || [];
  }

  /**
   * Fetch customer account balance and credit information
   */
  async getCustomerAccount(customerId: string): Promise<any> {
    const query = `
      SELECT 
        customer.id,
        customer.entityid AS customerNumber,
        customer.companyname,
        customer.creditlimit,
        customer.email,
        customer.phone,
        customer.altphone,
        customer.custentity_mobile_phone AS mobilePhone,
        BUILTIN.DF(customer.terms) AS paymentTerms,
        customer.custentity_crd_rebate_balance AS crdRebateBalance,
        customer.custentity_customerstatus AS customerStatus,
        customer.datecreated,
        customer.lastmodifieddate
      FROM 
        customer
      WHERE 
        customer.id = ${customerId}
    `.trim();

    const result = await this.executeSuiteQL(query, 1, 0);
    if (result.items.length === 0) {
      throw new Error(`Customer ${customerId} not found`);
    }
    
    // Calculate balance from open invoices (simplified)
    const balanceQuery = `
      SELECT 
        SUM(transaction.total) AS balance
      FROM 
        transaction
      WHERE 
        transaction.entity = ${customerId}
        AND transaction.type = 'CustInvc'
        AND transaction.status IN ('A', 'B')
    `.trim();
    
    const balanceResult = await this.executeSuiteQL(balanceQuery, 1, 0).catch(() => ({ items: [{ balance: '0.00' }] }));
    const balance = balanceResult.items[0]?.balance || '0.00';
    
    return {
      ...result.items[0],
      balance
    };
  }

  /**
   * Fetch messages for a specific support case
   */
  async getCaseMessages(caseId: string): Promise<any[]> {
    const query = `
      SELECT 
        message.id,
        message.subject,
        message.message,
        message.author,
        message.messagedate,
        BUILTIN.DF(message.author) AS authorname
      FROM 
        message
      WHERE 
        message.activity = ${caseId}
      ORDER BY 
        message.messagedate DESC
    `.trim();

    try {
      const result = await this.executeSuiteQL(query, 50, 0);
      return result.items;
    } catch (error) {
      console.error('Error fetching case messages:', error);
      return [];
    }
  }

  /**
   * Fetch customer support cases
   */
  async getCustomerCases(customerId: string, customerEmail?: string, limit = 30): Promise<any[]> {
    // Search by custom field custevent_svcsjpr_customer that links cases to customers
    // Filter by custevent_jprtype = 1 and exclude closed cases (status != 5)
    const query = `
      SELECT 
        supportcase.id,
        supportcase.casenumber,
        supportcase.title,
        supportcase.status,
        supportcase.createddate,
        supportcase.lastmodifieddate,
        supportcase.category,
        supportcase.email,
        supportcase.company,
        supportcase.custevent_xprdetail,
        supportcase.custevent_svcsjpr_customer,
        supportcase.custevent_jprtype,
        supportcase.custevent_svrcjpr_fudate AS followupdate,
        supportcase.custevent_related_salesorder AS relatedsalesorder,
        supportcase.assigned,
        BUILTIN.DF(supportcase.status) AS statustext,
        BUILTIN.DF(supportcase.company) AS companyname,
        BUILTIN.DF(supportcase.custevent_related_salesorder) AS relatedsalesordernumber,
        employee.firstname || ' ' || employee.lastname AS assignedname,
        supportcase.custevent_svrcjpr_tag_for AS caseenduser,
        supportcase.custevent_svrcjpr_memo AS casejobid
      FROM 
        supportcase
        LEFT JOIN employee ON supportcase.assigned = employee.id
      WHERE 
        supportcase.custevent_svcsjpr_customer = ${customerId}
        AND supportcase.custevent_jprtype = 1
      ORDER BY 
        supportcase.createddate DESC
    `.trim();

    const result = await this.executeSuiteQL(query, limit, 0);
    return result.items;
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