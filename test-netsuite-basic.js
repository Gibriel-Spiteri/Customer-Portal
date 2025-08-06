#!/usr/bin/env node

import crypto from 'crypto';

class NetSuiteBasicTest {
  constructor() {
    this.config = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY,
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
      tokenId: process.env.NETSUITE_TOKEN_ID,
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
    };
    
    console.log('NetSuite Configuration Check:');
    console.log('Account ID:', this.config.accountId ? 'SET' : 'MISSING');
    console.log('Consumer Key:', this.config.consumerKey ? 'SET (' + this.config.consumerKey.substring(0, 8) + '...)' : 'MISSING');
    console.log('Consumer Secret:', this.config.consumerSecret ? 'SET' : 'MISSING');
    console.log('Token ID:', this.config.tokenId ? 'SET (' + this.config.tokenId.substring(0, 8) + '...)' : 'MISSING');
    console.log('Token Secret:', this.config.tokenSecret ? 'SET' : 'MISSING');
    console.log('');
  }

  extractAccountId(accountUrl) {
    if (accountUrl.includes('://')) {
      // Extract from full URL like "https://1212804.app.netsuite.com/"
      const match = accountUrl.match(/\/\/(\d+)/);
      return match ? match[1] : accountUrl;
    } else if (accountUrl.includes('.')) {
      // Extract from domain like "1212804.app.netsuite.com"
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
    
    console.log('OAuth Signature Base String:');
    console.log(signatureBase);
    console.log('');
    
    // Generate signature
    const signingKey = `${this.config.consumerSecret}&${this.config.tokenSecret}`;
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(signatureBase)
      .digest('base64');
    
    console.log('OAuth Signature:', signature);
    console.log('');
    
    // Build OAuth header - use just the account number for realm, not the full URL
    const accountId = this.extractAccountId(this.config.accountId);
    
    const authHeader = 'OAuth ' + 
      `realm="${accountId}", ` +
      Object.keys(oauthParams)
        .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
        .concat(`oauth_signature="${encodeURIComponent(signature)}"`)
        .join(', ');
    
    return authHeader;
  }

  async testCompanyInfo() {
    console.log('=== Testing Company Information Endpoint ===');
    
    const accountId = this.extractAccountId(this.config.accountId);
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/companyinformation`;
    console.log('Using Account ID:', accountId);
    
    try {
      const authHeader = this.generateOAuthHeader('GET', url);
      
      console.log('Making request to:', url);
      console.log('Authorization header:', authHeader.substring(0, 100) + '...');
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
      console.log('Response Headers:');
      for (const [key, value] of response.headers.entries()) {
        console.log(`  ${key}: ${value}`);
      }
      console.log('');
      
      const responseText = await response.text();
      console.log('Response Body:');
      console.log(responseText);
      
      if (response.ok) {
        console.log('✅ SUCCESS: Company information retrieved');
        return JSON.parse(responseText);
      } else {
        console.log('❌ FAILED: Company information request failed');
        return null;
      }
      
    } catch (error) {
      console.error('❌ ERROR:', error.message);
      return null;
    }
  }

  async testSubsidiary() {
    console.log('=== Testing Subsidiary Endpoint ===');
    
    const accountId = this.extractAccountId(this.config.accountId);
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/subsidiary`;
    console.log('Using Account ID:', accountId);
    
    try {
      const authHeader = this.generateOAuthHeader('GET', url);
      
      console.log('Making request to:', url);
      console.log('Authorization header:', authHeader.substring(0, 100) + '...');
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
      console.log('Response Headers:');
      for (const [key, value] of response.headers.entries()) {
        console.log(`  ${key}: ${value}`);
      }
      console.log('');
      
      const responseText = await response.text();
      console.log('Response Body:');
      console.log(responseText);
      
      if (response.ok) {
        console.log('✅ SUCCESS: Subsidiary information retrieved');
        return JSON.parse(responseText);
      } else {
        console.log('❌ FAILED: Subsidiary request failed');
        return null;
      }
      
    } catch (error) {
      console.error('❌ ERROR:', error.message);
      return null;
    }
  }

  async runTests() {
    console.log('🧪 Starting NetSuite Basic API Tests\n');
    
    if (!this.config.accountId || !this.config.consumerKey || !this.config.consumerSecret || !this.config.tokenId || !this.config.tokenSecret) {
      console.error('❌ Missing required NetSuite credentials');
      process.exit(1);
    }
    
    // Test company information endpoint
    await this.testCompanyInfo();
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test subsidiary endpoint  
    await this.testSubsidiary();
    
    console.log('\n🏁 Tests completed');
  }
}

// Run the tests
const tester = new NetSuiteBasicTest();
tester.runTests().catch(console.error);