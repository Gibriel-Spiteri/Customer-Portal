#!/usr/bin/env node

import crypto from 'crypto';

class NetSuiteWorkingTest {
  constructor() {
    this.config = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY,
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
      tokenId: process.env.NETSUITE_TOKEN_ID,
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
    };
    
    console.log('NetSuite API Test - With Proper Query Parameters');
    console.log('=================================================');
    console.log('');
  }

  extractAccountId(accountUrl) {
    if (accountUrl.includes('://')) {
      const match = accountUrl.match(/\/\/(\d+)/);
      return match ? match[1] : accountUrl;
    } else if (accountUrl.includes('.')) {
      return accountUrl.split('.')[0];
    }
    return accountUrl;
  }

  generateOAuthHeader(method, url, queryParams = {}) {
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

    // Combine OAuth params with query params for signature
    const allParams = { ...oauthParams, ...queryParams };
    
    // Create signature base string
    const paramString = Object.keys(allParams)
      .sort()
      .map(key => `${key}=${encodeURIComponent(allParams[key])}`)
      .join('&');
    
    const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    
    // Generate signature
    const signingKey = `${this.config.consumerSecret}&${this.config.tokenSecret}`;
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(signatureBase)
      .digest('base64');
    
    // Build OAuth header
    const accountId = this.extractAccountId(this.config.accountId);
    const authHeader = 'OAuth ' + 
      `realm="${accountId}", ` +
      Object.keys(oauthParams)
        .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
        .concat(`oauth_signature="${encodeURIComponent(signature)}"`)
        .join(', ');
    
    return authHeader;
  }

  async testCustomerList() {
    console.log('📋 Testing Customer List with Query Parameters\n');
    
    const accountId = this.extractAccountId(this.config.accountId);
    const baseUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/customer`;
    
    // NetSuite REST API requires limit parameter
    const queryParams = {
      limit: '5'
    };
    
    const urlWithParams = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;
    
    try {
      const authHeader = this.generateOAuthHeader('GET', baseUrl, queryParams);
      
      console.log('Request URL:', urlWithParams);
      console.log('Query Parameters:', queryParams);
      console.log('');
      
      const response = await fetch(urlWithParams, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response Status:', response.status);
      
      const responseText = await response.text();
      
      if (response.ok) {
        console.log('✅ SUCCESS! Customers retrieved\n');
        const data = JSON.parse(responseText);
        console.log('Response Summary:');
        console.log('- Total Results:', data.totalResults || data.count || 'N/A');
        console.log('- Has More:', data.hasMore || false);
        console.log('- Items Retrieved:', data.items?.length || 0);
        
        if (data.items && data.items.length > 0) {
          console.log('\nFirst Customer:');
          console.log(JSON.stringify(data.items[0], null, 2));
        }
        return true;
      } else {
        console.log('❌ Failed with status:', response.status);
        try {
          const error = JSON.parse(responseText);
          console.log('Error Details:', JSON.stringify(error, null, 2));
        } catch {
          console.log('Error:', responseText);
        }
        return false;
      }
      
    } catch (error) {
      console.error('❌ Request error:', error.message);
      return false;
    }
  }

  async testSalesOrderList() {
    console.log('\n📦 Testing Sales Order List with Query Parameters\n');
    
    const accountId = this.extractAccountId(this.config.accountId);
    const baseUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/salesorder`;
    
    // Query with limit
    const queryParams = {
      limit: '5'
    };
    
    const urlWithParams = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;
    
    try {
      const authHeader = this.generateOAuthHeader('GET', baseUrl, queryParams);
      
      console.log('Request URL:', urlWithParams);
      console.log('Query Parameters:', queryParams);
      console.log('');
      
      const response = await fetch(urlWithParams, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response Status:', response.status);
      
      const responseText = await response.text();
      
      if (response.ok) {
        console.log('✅ SUCCESS! Sales Orders retrieved\n');
        const data = JSON.parse(responseText);
        console.log('Response Summary:');
        console.log('- Total Results:', data.totalResults || data.count || 'N/A');
        console.log('- Items Retrieved:', data.items?.length || 0);
        
        if (data.items && data.items.length > 0) {
          console.log('\nFirst Sales Order:');
          const order = data.items[0];
          console.log('- ID:', order.id);
          console.log('- Transaction Number:', order.tranId || order.transactionNumber);
          console.log('- Date:', order.tranDate || order.transactionDate);
          console.log('- Status:', order.status);
          console.log('- Total:', order.total);
        }
        return true;
      } else {
        console.log('❌ Failed with status:', response.status);
        try {
          const error = JSON.parse(responseText);
          console.log('Error Details:', JSON.stringify(error, null, 2));
        } catch {
          console.log('Error:', responseText);
        }
        return false;
      }
      
    } catch (error) {
      console.error('❌ Request error:', error.message);
      return false;
    }
  }

  async testInvoiceList() {
    console.log('\n💵 Testing Invoice List with Query Parameters\n');
    
    const accountId = this.extractAccountId(this.config.accountId);
    const baseUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/invoice`;
    
    const queryParams = {
      limit: '5'
    };
    
    const urlWithParams = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;
    
    try {
      const authHeader = this.generateOAuthHeader('GET', baseUrl, queryParams);
      
      console.log('Request URL:', urlWithParams);
      console.log('');
      
      const response = await fetch(urlWithParams, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response Status:', response.status);
      
      const responseText = await response.text();
      
      if (response.ok) {
        console.log('✅ SUCCESS! Invoices retrieved\n');
        const data = JSON.parse(responseText);
        console.log('Response Summary:');
        console.log('- Items Retrieved:', data.items?.length || 0);
        return true;
      } else {
        console.log('❌ Failed with status:', response.status);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Request error:', error.message);
      return false;
    }
  }

  async runTests() {
    console.log('🚀 Starting NetSuite API Tests with Proper Parameters\n');
    console.log('=' .repeat(60) + '\n');
    
    const results = {
      customers: await this.testCustomerList(),
      salesOrders: await this.testSalesOrderList(),
      invoices: await this.testInvoiceList()
    };
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n📊 FINAL RESULTS:\n');
    
    const working = Object.values(results).some(r => r);
    
    if (working) {
      console.log('🎉 NetSuite API Integration is WORKING!');
      console.log('\nWorking endpoints:');
      if (results.customers) console.log('   ✅ Customers');
      if (results.salesOrders) console.log('   ✅ Sales Orders');
      if (results.invoices) console.log('   ✅ Invoices');
      
      const notWorking = Object.entries(results).filter(([k,v]) => !v);
      if (notWorking.length > 0) {
        console.log('\nEndpoints needing attention:');
        notWorking.forEach(([endpoint]) => {
          console.log(`   ⚠️  ${endpoint}`);
        });
      }
    } else {
      console.log('⚠️  Additional configuration may be needed.');
      console.log('   Check if there is data in NetSuite for these record types.');
    }
  }
}

// Run the tests
const tester = new NetSuiteWorkingTest();
tester.runTests().catch(console.error);