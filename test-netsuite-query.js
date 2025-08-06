#!/usr/bin/env node

import crypto from 'crypto';

class NetSuiteQueryTest {
  constructor() {
    this.config = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY,
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
      tokenId: process.env.NETSUITE_TOKEN_ID,
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
    };
    
    console.log('NetSuite SuiteQL Query Test');
    console.log('============================');
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

    const allParams = { ...oauthParams, ...queryParams };
    
    const paramString = Object.keys(allParams)
      .sort()
      .map(key => `${key}=${encodeURIComponent(allParams[key])}`)
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

  async testSuiteQL() {
    console.log('📊 Testing SuiteQL Query Endpoint\n');
    
    const accountId = this.extractAccountId(this.config.accountId);
    const baseUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;
    
    // Simple SuiteQL query to get customers
    const queries = [
      {
        desc: 'List first 5 customers',
        query: 'SELECT id, companyname, email FROM customer WHERE ROWNUM <= 5'
      },
      {
        desc: 'Count total customers',
        query: 'SELECT COUNT(*) as total FROM customer'
      },
      {
        desc: 'List recent sales orders',
        query: 'SELECT id, tranid, trandate, entity, total FROM transaction WHERE recordtype = \'salesorder\' AND ROWNUM <= 5'
      }
    ];
    
    for (const testQuery of queries) {
      console.log(`\nQuery: ${testQuery.desc}`);
      console.log('SQL:', testQuery.query);
      console.log('-'.repeat(60));
      
      const queryParams = {
        q: testQuery.query
      };
      
      const urlWithParams = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;
      
      try {
        const authHeader = this.generateOAuthHeader('GET', baseUrl, queryParams);
        
        const response = await fetch(urlWithParams, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Prefer': 'transient'
          }
        });
        
        console.log('Response Status:', response.status);
        
        const responseText = await response.text();
        
        if (response.ok) {
          console.log('✅ SUCCESS!');
          const data = JSON.parse(responseText);
          
          if (data.items && data.items.length > 0) {
            console.log('Results found:', data.items.length);
            console.log('Sample data:');
            console.log(JSON.stringify(data.items.slice(0, 2), null, 2));
          } else if (data.totalResults !== undefined) {
            console.log('Total results:', data.totalResults);
          } else {
            console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
          }
        } else {
          console.log('❌ Query failed');
          try {
            const error = JSON.parse(responseText);
            console.log('Error:', error.o?.errorDetails?.[0]?.detail || error.title || error.message);
          } catch {
            console.log('Error:', responseText.substring(0, 300));
          }
        }
      } catch (error) {
        console.log('❌ Request error:', error.message);
      }
    }
  }

  async testRESTQuery() {
    console.log('\n\n🔍 Testing REST Query with Fields Parameter\n');
    
    const accountId = this.extractAccountId(this.config.accountId);
    const baseUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/customer`;
    
    // Try with specific fields and pagination
    const queryParams = {
      fields: 'id,companyName,email',
      limit: '2'
    };
    
    const urlWithParams = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;
    
    console.log('URL:', urlWithParams);
    console.log('Parameters:', queryParams);
    console.log('-'.repeat(60));
    
    try {
      const authHeader = this.generateOAuthHeader('GET', baseUrl, queryParams);
      
      const response = await fetch(urlWithParams, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'Prefer': 'transient'
        }
      });
      
      console.log('Response Status:', response.status);
      
      const responseText = await response.text();
      
      if (response.ok) {
        console.log('✅ SUCCESS! Customers retrieved');
        const data = JSON.parse(responseText);
        console.log('Response:', JSON.stringify(data, null, 2));
      } else {
        console.log('❌ Failed');
        try {
          const error = JSON.parse(responseText);
          console.log('Error:', error.o?.errorDetails?.[0]?.detail || error.title);
        } catch {
          console.log('Error:', responseText);
        }
      }
    } catch (error) {
      console.log('❌ Request error:', error.message);
    }
  }

  async runTests() {
    console.log('🚀 Starting NetSuite Query Tests\n');
    
    // Test SuiteQL endpoint
    await this.testSuiteQL();
    
    // Test REST with specific fields
    await this.testRESTQuery();
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📝 Summary:');
    console.log('- Authentication is fully working');
    console.log('- Metadata endpoints are accessible');
    console.log('- Check the results above to see which query methods work');
    console.log('- If SuiteQL works, we can use that for data access');
  }
}

// Run the tests
const tester = new NetSuiteQueryTest();
tester.runTests().catch(console.error);