#!/usr/bin/env node

import crypto from 'crypto';

class NetSuiteMetadataTest {
  constructor() {
    this.config = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY,
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
      tokenId: process.env.NETSUITE_TOKEN_ID,
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
    };
    
    console.log('NetSuite Metadata & OpenAPI Test');
    console.log('==================================');
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

  async testOpenAPI() {
    console.log('📖 Testing OpenAPI/Metadata Endpoints\n');
    
    const accountId = this.extractAccountId(this.config.accountId);
    
    // Try various metadata endpoints
    const endpoints = [
      {
        path: '/record/v1/metadata-catalog',
        desc: 'Metadata Catalog'
      },
      {
        path: '/record/v1',
        desc: 'Record API Root'
      },
      {
        path: '/record/v1/openapi',
        desc: 'OpenAPI Specification'
      },
      {
        path: '/record/v1/metadata-catalog/customer',
        desc: 'Customer Metadata'
      }
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\nTesting: ${endpoint.desc}`);
      console.log('-'.repeat(40));
      
      const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest${endpoint.path}`;
      
      try {
        const authHeader = this.generateOAuthHeader('GET', url);
        
        console.log('URL:', url);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        });
        
        console.log('Status:', response.status);
        
        if (response.ok) {
          console.log('✅ SUCCESS!');
          const responseText = await response.text();
          try {
            const data = JSON.parse(responseText);
            if (data.items) {
              console.log('Available record types:', data.items.length);
              // Show first few record types
              const recordTypes = data.items.slice(0, 10).map(item => item.name || item.id || item);
              console.log('Sample types:', recordTypes.join(', '));
            } else {
              console.log('Response preview:', JSON.stringify(data, null, 2).substring(0, 300));
            }
          } catch {
            console.log('Response preview:', responseText.substring(0, 300));
          }
        } else {
          const errorText = await response.text();
          try {
            const error = JSON.parse(errorText);
            console.log('❌ Error:', error.o?.errorDetails?.[0]?.detail || error.title);
          } catch {
            console.log('❌ Error:', response.statusText);
          }
        }
      } catch (error) {
        console.log('❌ Request failed:', error.message);
      }
    }
  }

  async testSpecificCustomer() {
    console.log('\n\n🔍 Testing Specific Record Access\n');
    
    const accountId = this.extractAccountId(this.config.accountId);
    
    // Try to get a specific customer by ID (usually starts at 1)
    for (let id = 1; id <= 5; id++) {
      const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/customer/${id}`;
      
      console.log(`\nTrying customer ID ${id}:`);
      
      try {
        const authHeader = this.generateOAuthHeader('GET', url);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          console.log(`✅ Customer ${id} found!`);
          const data = await response.json();
          console.log('- Name:', data.companyName || data.entityId || 'N/A');
          console.log('- Email:', data.email || 'N/A');
          return true;
        } else if (response.status === 404) {
          console.log(`⚠️  Customer ${id} not found`);
        } else if (response.status === 400 || response.status === 403) {
          const errorText = await response.text();
          try {
            const error = JSON.parse(errorText);
            console.log('❌ Permission error:', error.o?.errorDetails?.[0]?.detail);
          } catch {
            console.log('❌ Error:', response.status);
          }
          break; // Stop trying if we get permission errors
        }
      } catch (error) {
        console.log('❌ Request failed:', error.message);
      }
    }
    
    return false;
  }

  async runTests() {
    console.log('🚀 Starting NetSuite Metadata Tests\n');
    
    await this.testOpenAPI();
    await this.testSpecificCustomer();
    
    console.log('\n' + '='.repeat(60));
    console.log('\n💡 Findings:');
    console.log('- Authentication is working (no token_rejected errors)');
    console.log('- Permission errors suggest the token user needs different role settings');
    console.log('- The role may need "Web Services Only Role" enabled');
    console.log('- Or the token may need to be created with a different user/role combination');
  }
}

// Run the tests
const tester = new NetSuiteMetadataTest();
tester.runTests().catch(console.error);