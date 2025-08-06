#!/usr/bin/env node

import crypto from 'crypto';

// Direct test with minimal complexity
const config = {
  accountId: process.env.NETSUITE_ACCOUNT_ID?.replace(/[^\d]/g, '') || '1212804',
  consumerKey: process.env.NETSUITE_CONSUMER_KEY,
  consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
  tokenId: process.env.NETSUITE_TOKEN_ID,
  tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
};

console.log('NetSuite Direct API Test');
console.log('========================\n');

// Show configuration (partial for security)
console.log('Configuration:');
console.log('- Account ID:', config.accountId);
console.log('- Consumer Key:', config.consumerKey?.substring(0, 15) + '...');
console.log('- Token ID:', config.tokenId?.substring(0, 15) + '...');
console.log('- Consumer Secret:', config.consumerSecret ? 'SET' : 'MISSING');
console.log('- Token Secret:', config.tokenSecret ? 'SET' : 'MISSING');

// Generate OAuth 1.0a signature
function generateOAuth(method, url) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  const oauthParams = {
    oauth_consumer_key: config.consumerKey,
    oauth_token: config.tokenId,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0'
  };

  // Create parameter string
  const paramString = Object.keys(oauthParams)
    .sort()
    .map(key => `${key}=${encodeURIComponent(oauthParams[key])}`)
    .join('&');
  
  // Create signature base string
  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  
  console.log('\nDebug Info:');
  console.log('- Timestamp:', timestamp);
  console.log('- Nonce:', nonce);
  console.log('- Parameter String (first 100):', paramString.substring(0, 100) + '...');
  console.log('- Signature Base (first 200):', signatureBase.substring(0, 200) + '...');
  
  // Create signature
  const signingKey = `${config.consumerSecret}&${config.tokenSecret}`;
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(signatureBase)
    .digest('base64');
  
  console.log('- Signature:', signature);
  
  // Create authorization header
  const authHeader = 'OAuth ' + 
    `realm="${config.accountId}", ` +
    Object.keys(oauthParams)
      .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
      .concat(`oauth_signature="${encodeURIComponent(signature)}"`)
      .join(', ');
  
  return authHeader;
}

// Test the API
async function testAPI() {
  const url = `https://${config.accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/metadata-catalog`;
  
  console.log('\nAPI Request:');
  console.log('- URL:', url);
  
  const authHeader = generateOAuth('GET', url);
  console.log('- Auth Header (first 200):', authHeader.substring(0, 200) + '...');
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\nResponse:');
    console.log('- Status:', response.status, response.statusText);
    
    const wwwAuth = response.headers.get('www-authenticate');
    if (wwwAuth) {
      console.log('- WWW-Authenticate:', wwwAuth);
    }
    
    const text = await response.text();
    
    if (response.ok) {
      console.log('✅ SUCCESS! API is working.');
      console.log('Response preview:', text.substring(0, 200));
    } else {
      console.log('❌ FAILED');
      try {
        const error = JSON.parse(text);
        console.log('Error:', JSON.stringify(error, null, 2));
      } catch {
        console.log('Response:', text);
      }
    }
  } catch (error) {
    console.log('❌ Request Error:', error.message);
  }
}

// Additional diagnostics
console.log('\n' + '='.repeat(60));
console.log('DIAGNOSTIC INFORMATION');
console.log('='.repeat(60));

console.log('\n1. URL Format Check:');
const testUrl = `https://${config.accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/metadata-catalog`;
console.log('   Full URL:', testUrl);
console.log('   Account ID extracted:', config.accountId);
console.log('   Is numeric:', /^\d+$/.test(config.accountId));

console.log('\n2. Credential Length Check:');
console.log('   Consumer Key length:', config.consumerKey?.length || 0);
console.log('   Consumer Secret length:', config.consumerSecret?.length || 0);
console.log('   Token ID length:', config.tokenId?.length || 0);
console.log('   Token Secret length:', config.tokenSecret?.length || 0);

console.log('\n3. Common Issues to Check:');
console.log('   ❓ Is the integration enabled in NetSuite?');
console.log('   ❓ Is Token-Based Authentication the ONLY auth method checked?');
console.log('   ❓ Are all OAuth 2.0 options unchecked?');
console.log('   ❓ Is the access token status "Active" or "Enabled"?');
console.log('   ❓ Does the token user have Administrator role?');

console.log('\n' + '='.repeat(60));

// Run the test
testAPI().catch(console.error);