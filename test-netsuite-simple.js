#!/usr/bin/env node

import crypto from 'crypto';

class NetSuiteSimpleTest {
  constructor() {
    this.config = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY,
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
      tokenId: process.env.NETSUITE_TOKEN_ID,
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
    };
    
    console.log('Updated NetSuite Configuration:');
    console.log('Account ID:', this.config.accountId ? 'SET' : 'MISSING');
    console.log('Consumer Key:', this.config.consumerKey ? 'SET (' + this.config.consumerKey.substring(0, 8) + '...)' : 'MISSING');
    console.log('Consumer Secret:', this.config.consumerSecret ? 'SET' : 'MISSING');
    console.log('Token ID:', this.config.tokenId ? 'SET (' + this.config.tokenId.substring(0, 8) + '...)' : 'MISSING');
    console.log('Token Secret:', this.config.tokenSecret ? 'SET' : 'MISSING');
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
    console.log(`=== Testing ${description} ===`);
    
    const accountId = this.extractAccountId(this.config.accountId);
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${endpointPath}`;
    
    try {
      const authHeader = this.generateOAuthHeader('GET', url);
      
      console.log('Request URL:', url);
      console.log('');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Prefer': 'transient'
        }
      });
      
      console.log('Response Status:', response.status);
      
      // Log important headers
      const wwwAuthHeader = response.headers.get('www-authenticate');
      if (wwwAuthHeader) {
        console.log('WWW-Authenticate:', wwwAuthHeader);
      }
      
      const responseText = await response.text();
      console.log('Response Body:');
      console.log(responseText);
      
      if (response.ok) {
        console.log('✅ SUCCESS:', description, 'retrieved');
        return { success: true, data: JSON.parse(responseText) };
      } else {
        console.log('❌ FAILED:', description, 'request failed');
        return { success: false, status: response.status, body: responseText };
      }
      
    } catch (error) {
      console.error('❌ ERROR:', error.message);
      return { success: false, error: error.message };
    }
  }

  async runTests() {
    console.log('🔄 Testing Updated NetSuite Credentials\n');
    
    if (!this.config.accountId || !this.config.consumerKey || !this.config.consumerSecret || !this.config.tokenId || !this.config.tokenSecret) {
      console.error('❌ Missing required NetSuite credentials');
      process.exit(1);
    }
    
    // Test multiple endpoints to see if any work
    const endpoints = [
      { path: 'companyinformation', desc: 'Company Information' },
      { path: 'subsidiary', desc: 'Subsidiary' },
      { path: 'currency', desc: 'Currency' },
      { path: 'account', desc: 'Chart of Accounts' }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      const result = await this.testEndpoint(endpoint.path, endpoint.desc);
      results.push({ ...endpoint, result });
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
    // Summary
    console.log('📊 Test Results Summary:');
    results.forEach(({ desc, result }) => {
      const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
      console.log(`${status}: ${desc}`);
    });
    
    console.log('\n🏁 Tests completed');
    
    // If all failed with same error, provide guidance
    const allFailed = results.every(r => !r.result.success);
    const sameError = results.every(r => r.result.status === 401);
    
    if (allFailed && sameError) {
      console.log('\n💡 All endpoints failed with 401 errors. This suggests:');
      console.log('   1. Token permissions issue');
      console.log('   2. Integration record configuration');
      console.log('   3. User role permissions');
      console.log('   4. REST Web Services not enabled');
    }
  }
}

// Run the tests
const tester = new NetSuiteSimpleTest();
tester.runTests().catch(console.error);