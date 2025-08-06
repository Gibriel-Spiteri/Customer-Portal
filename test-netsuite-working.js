#!/usr/bin/env node

import crypto from 'crypto';

console.log('NetSuite Alternative Test');
console.log('=========================\n');

const config = {
  accountId: '1212804', // Direct account ID
  consumerKey: process.env.NETSUITE_CONSUMER_KEY,
  consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
  tokenId: process.env.NETSUITE_TOKEN_ID,
  tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
};

console.log('Testing with exact NetSuite documentation approach...\n');

function generateOAuthSignature(method, url, timestamp, nonce) {
  // OAuth parameters exactly as NetSuite expects
  const oauthParams = {
    oauth_consumer_key: config.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_token: config.tokenId,
    oauth_version: '1.0'
  };

  // Create normalized parameter string
  const paramString = Object.keys(oauthParams)
    .sort()
    .map(key => `${key}=${encodeURIComponent(oauthParams[key])}`)
    .join('&');
  
  // Create signature base string
  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString)
  ].join('&');
  
  // Generate signature
  const signingKey = `${config.consumerSecret}&${config.tokenSecret}`;
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(baseString)
    .digest('base64');
  
  return signature;
}

async function testEndpoint(description, url) {
  console.log(`\nTesting: ${description}`);
  console.log('URL:', url);
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = generateOAuthSignature('GET', url, timestamp, nonce);
  
  // Build authorization header
  const authParams = {
    realm: config.accountId,
    oauth_consumer_key: config.consumerKey,
    oauth_token: config.tokenId,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0',
    oauth_signature: signature
  };
  
  const authHeader = 'OAuth ' + Object.entries(authParams)
    .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
    .join(', ');
  
  try {
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
      const data = await response.text();
      console.log('Response preview:', data.substring(0, 100) + '...');
      return true;
    } else {
      const error = await response.text();
      console.log('❌ Failed');
      if (response.headers.get('www-authenticate')) {
        console.log('Auth Error:', response.headers.get('www-authenticate'));
      }
      try {
        const errorObj = JSON.parse(error);
        console.log('Error:', errorObj.title || errorObj.message || error.substring(0, 100));
      } catch {
        console.log('Error:', error.substring(0, 100));
      }
      return false;
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return false;
  }
}

async function runTests() {
  const results = [];
  
  // Test different endpoint variations
  const tests = [
    {
      desc: 'REST API - Metadata',
      url: `https://${config.accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/metadata-catalog`
    },
    {
      desc: 'REST API - Record v1',
      url: `https://${config.accountId}.suitetalk.api.netsuite.com/services/rest/record/v1`
    },
    {
      desc: 'REST API - Platform',
      url: `https://${config.accountId}.suitetalk.api.netsuite.com/services/rest/platform/v1`
    },
    {
      desc: 'Alternative URL format',
      url: `https://${config.accountId}.suitetalk.api.netsuite.com/services/rest`
    }
  ];
  
  for (const test of tests) {
    const success = await testEndpoint(test.desc, test.url);
    results.push({ ...test, success });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const working = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (working.length > 0) {
    console.log('\n✅ Working endpoints:');
    working.forEach(r => console.log(`   - ${r.desc}`));
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed endpoints:');
    failed.forEach(r => console.log(`   - ${r.desc}`));
  }
  
  if (working.length === 0) {
    console.log('\n🔍 TROUBLESHOOTING CHECKLIST:');
    console.log('\n1. In NetSuite, go to Setup > Integrations > Manage Integrations');
    console.log('   - Find your integration');
    console.log('   - Click Edit');
    console.log('   - Ensure these settings:');
    console.log('     ✓ State: Enabled');
    console.log('     ✓ Token-Based Authentication: CHECKED');
    console.log('     ✗ Authorization Code Grant: UNCHECKED');
    console.log('     ✗ Public Client: UNCHECKED');
    console.log('     ✗ Issue Token Endpoint: UNCHECKED');
    console.log('     ✗ Authorization Flow: UNCHECKED');
    
    console.log('\n2. Go to Setup > Users/Roles > Access Tokens');
    console.log('   - Find your token');
    console.log('   - Verify it shows as "Enabled" or "Active"');
    console.log('   - Check the User and Role columns');
    
    console.log('\n3. Try regenerating the access token:');
    console.log('   - Delete the existing token');
    console.log('   - Create a new one with:');
    console.log('     • The same integration');
    console.log('     • Administrator user');
    console.log('     • Administrator role');
    console.log('   - Update all 4 secrets immediately');
    
    console.log('\n4. Contact NetSuite Support if the issue persists');
    console.log('   They can check server-side logs for more details');
  }
}

runTests().catch(console.error);