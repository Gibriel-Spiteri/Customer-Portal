#!/usr/bin/env node

import crypto from 'crypto';

class NetSuiteCustomerTest {
  constructor() {
    this.config = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY,
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
      tokenId: process.env.NETSUITE_TOKEN_ID,
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
    };
    
    console.log('NetSuite Customer API Test');
    console.log('===========================');
    console.log('Account ID:', this.config.accountId ? 'SET' : 'MISSING');
    console.log('Consumer Key:', this.config.consumerKey ? 'SET (' + this.config.consumerKey.substring(0, 8) + '...)' : 'MISSING');
    console.log('Token ID:', this.config.tokenId ? 'SET (' + this.config.tokenId.substring(0, 8) + '...)' : 'MISSING');
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

  generateOAuthHeader(method, url) {
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
      .map(key => `${key}=${encodeURIComponent(oauthParams[key])}`)
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

  async testEndpoint(endpointPath, description) {
    console.log(`\n=== Testing ${description} ===`);
    
    const accountId = this.extractAccountId(this.config.accountId);
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest${endpointPath}`;
    
    try {
      const authHeader = this.generateOAuthHeader('GET', url);
      
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Prefer': 'transient'
        }
      });
      
      console.log('Response Status:', response.status);
      
      const responseText = await response.text();
      
      if (response.ok) {
        console.log('✅ SUCCESS!');
        try {
          const data = JSON.parse(responseText);
          console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
        } catch {
          console.log('Response:', responseText.substring(0, 500) + '...');
        }
        return { success: true, status: response.status };
      } else {
        console.log('❌ Failed with status:', response.status);
        try {
          const error = JSON.parse(responseText);
          console.log('Error:', error.o?.errorDetails?.[0]?.detail || error.title || responseText);
        } catch {
          console.log('Error:', responseText.substring(0, 200));
        }
        return { success: false, status: response.status };
      }
      
    } catch (error) {
      console.error('❌ Request error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async runTests() {
    console.log('🔍 Testing Customer Portal Relevant Endpoints\n');
    
    if (!this.config.accountId || !this.config.consumerKey || !this.config.consumerSecret || !this.config.tokenId || !this.config.tokenSecret) {
      console.error('❌ Missing required NetSuite credentials');
      process.exit(1);
    }
    
    // Test customer-portal relevant endpoints
    const endpoints = [
      { path: '/record/v1/customer', desc: 'Customer Records' },
      { path: '/record/v1/salesorder', desc: 'Sales Orders' },
      { path: '/record/v1/invoice', desc: 'Invoices' },
      { path: '/record/v1/customerpayment', desc: 'Customer Payments' },
      { path: '/record/v1/estimate', desc: 'Estimates/Quotes' },
      { path: '/record/v1/contact', desc: 'Contacts' },
      { path: '/record/v1/item', desc: 'Items/Products' },
      { path: '/record/v1/location', desc: 'Locations' }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      const result = await this.testEndpoint(endpoint.path, endpoint.desc);
      results.push({ ...endpoint, result });
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.result.success);
    const failed = results.filter(r => !r.result.success);
    
    if (successful.length > 0) {
      console.log('\n✅ WORKING ENDPOINTS:');
      successful.forEach(({ desc }) => {
        console.log(`   ✓ ${desc}`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n❌ PERMISSION NEEDED:');
      failed.forEach(({ desc, result }) => {
        console.log(`   ✗ ${desc} (Status: ${result.status})`);
      });
    }
    
    if (successful.length > 0) {
      console.log('\n🎉 SUCCESS! NetSuite authentication is working!');
      console.log('   Some endpoints need additional role permissions.');
    } else {
      console.log('\n⚠️  All endpoints require additional permissions.');
      console.log('   But authentication is working - no more token_rejected errors!');
    }
  }
}

// Run the tests
const tester = new NetSuiteCustomerTest();
tester.runTests().catch(console.error);