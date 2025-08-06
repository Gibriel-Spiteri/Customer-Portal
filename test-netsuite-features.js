#!/usr/bin/env node

import crypto from 'crypto';

class NetSuiteFeatureTest {
  constructor() {
    this.config = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY,
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
      tokenId: process.env.NETSUITE_TOKEN_ID,
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
    };
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

    const paramString = Object.keys(oauthParams)
      .sort()
      .map(key => `${key}=${encodeURIComponent(oauthParams[key])}`)
      .join('&');
    
    const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    
    const signingKey = `${this.config.consumerSecret}&${this.config.tokenSecret}`;
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(signatureBase)
      .digest('base64');
    
    const accountId = this.extractAccountId(this.config.accountId);
    const authHeader = 'OAuth ' + 
      `realm="${accountId}", ` +
      Object.keys(oauthParams)
        .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
        .concat(`oauth_signature="${encodeURIComponent(signature)}"`)
        .join(', ');
    
    return authHeader;
  }

  async testEndpoint(url, description, additionalHeaders = {}) {
    console.log(`\n${description}`);
    console.log('-'.repeat(50));
    console.log('URL:', url);
    
    try {
      const authHeader = this.generateOAuthHeader('GET', url);
      
      const headers = {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...additionalHeaders
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      console.log('Status:', response.status);
      
      if (!response.ok) {
        const wwwAuth = response.headers.get('www-authenticate');
        if (wwwAuth) {
          console.log('WWW-Authenticate:', wwwAuth);
        }
      }
      
      const responseText = await response.text();
      
      if (response.ok) {
        console.log('✅ SUCCESS!');
        return { success: true, data: responseText };
      } else {
        try {
          const error = JSON.parse(responseText);
          const detail = error.o?.errorDetails?.[0]?.detail || error.title || 'Unknown error';
          console.log('❌ Error:', detail);
          return { success: false, error: detail };
        } catch {
          console.log('❌ Error:', responseText.substring(0, 100));
          return { success: false, error: responseText.substring(0, 100) };
        }
      }
    } catch (error) {
      console.log('❌ Request failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async runTests() {
    console.log('NetSuite Feature & Connection Test');
    console.log('==================================');
    console.log('\nTesting different endpoints and headers...');
    
    const accountId = this.extractAccountId(this.config.accountId);
    const baseUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest`;
    
    // Test different endpoints with various approaches
    const tests = [
      {
        url: `${baseUrl}/record/v1/metadata-catalog`,
        desc: '📊 Metadata Catalog (Basic)',
        headers: {}
      },
      {
        url: `${baseUrl}/record/v1/metadata-catalog`,
        desc: '📊 Metadata Catalog (with Prefer header)',
        headers: { 'Prefer': 'transient' }
      },
      {
        url: `${baseUrl}/record/v1`,
        desc: '🏠 Record API Root',
        headers: {}
      },
      {
        url: `https://${accountId}.suitetalk.api.netsuite.com/services/rest/platform/v1/capabilities`,
        desc: '⚙️ Platform Capabilities',
        headers: {}
      },
      {
        url: `${baseUrl}/platform/v1/capabilities`,
        desc: '⚙️ Platform Capabilities (alternative)',
        headers: {}
      }
    ];
    
    const results = [];
    
    for (const test of tests) {
      const result = await this.testEndpoint(test.url, test.desc, test.headers);
      results.push({ ...test, result });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.result.success);
    const failed = results.filter(r => !r.result.success);
    
    if (successful.length > 0) {
      console.log('\n✅ WORKING ENDPOINTS:');
      successful.forEach(test => {
        console.log(`   ✓ ${test.desc}`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n❌ FAILED ENDPOINTS:');
      failed.forEach(test => {
        console.log(`   ✗ ${test.desc}`);
        console.log(`     Error: ${test.result.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (successful.length === 0) {
      console.log('\n🔍 TROUBLESHOOTING SUGGESTIONS:');
      console.log('\n1. Check NetSuite Login Audit Trail:');
      console.log('   Setup > Users/Roles > User Management > View Login Audit Trail');
      console.log('   Look for recent failed attempts with your token user');
      
      console.log('\n2. Verify Integration Settings:');
      console.log('   - Token-Based Authentication: Enabled');
      console.log('   - All OAuth 2.0 options: Disabled');
      console.log('   - REST Web Services: Enabled');
      
      console.log('\n3. Check Access Token:');
      console.log('   - Created with Administrator user and role');
      console.log('   - Associated with the correct integration');
      console.log('   - Token is Active/Enabled');
      
      console.log('\n4. Verify Company Features:');
      console.log('   Setup > Company > Enable Features > SuiteCloud');
      console.log('   - REST Web Services: Enabled');
      console.log('   - Token-Based Authentication: Enabled');
    } else {
      console.log('\n🎉 NetSuite API authentication is working!');
      console.log('Some endpoints are accessible, indicating proper setup.');
    }
  }
}

const tester = new NetSuiteFeatureTest();
tester.runTests().catch(console.error);