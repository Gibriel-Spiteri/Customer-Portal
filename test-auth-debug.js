#!/usr/bin/env node

import crypto from 'crypto';

console.log('NetSuite Auth Debug Test');
console.log('========================\n');

// Load credentials
const config = {
  accountId: process.env.NETSUITE_ACCOUNT_ID,
  consumerKey: process.env.NETSUITE_CONSUMER_KEY,
  consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
  tokenId: process.env.NETSUITE_TOKEN_ID,
  tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
};

// Extract account ID
function extractAccountId(accountUrl) {
  if (accountUrl.includes('://')) {
    const match = accountUrl.match(/\/\/(\d+)/);
    return match ? match[1] : accountUrl;
  } else if (accountUrl.includes('.')) {
    return accountUrl.split('.')[0];
  }
  return accountUrl;
}

const accountId = extractAccountId(config.accountId);

console.log('Credentials Status:');
console.log('Account ID:', accountId);
console.log('Consumer Key:', config.consumerKey ? config.consumerKey.substring(0, 12) + '...' : 'MISSING');
console.log('Consumer Secret:', config.consumerSecret ? 'SET (hidden)' : 'MISSING');
console.log('Token ID:', config.tokenId ? config.tokenId.substring(0, 12) + '...' : 'MISSING');
console.log('Token Secret:', config.tokenSecret ? 'SET (hidden)' : 'MISSING');

// Test basic metadata endpoint
console.log('\n\nTesting Simple Metadata Endpoint...');
console.log('====================================\n');

const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/metadata-catalog`;
const method = 'GET';

// Generate OAuth parameters
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

console.log('OAuth Parameters:');
console.log('- Timestamp:', timestamp);
console.log('- Nonce:', nonce);
console.log('- Consumer Key:', oauthParams.oauth_consumer_key.substring(0, 12) + '...');
console.log('- Token ID:', oauthParams.oauth_token.substring(0, 12) + '...');

// Create signature base string
const paramString = Object.keys(oauthParams)
  .sort()
  .map(key => `${key}=${encodeURIComponent(oauthParams[key])}`)
  .join('&');

const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;

console.log('\nSignature Base String (first 200 chars):');
console.log(signatureBase.substring(0, 200) + '...');

// Generate signature
const signingKey = `${config.consumerSecret}&${config.tokenSecret}`;
const signature = crypto
  .createHmac('sha256', signingKey)
  .update(signatureBase)
  .digest('base64');

console.log('\nOAuth Signature:', signature);

// Build OAuth header
const authHeader = 'OAuth ' + 
  `realm="${accountId}", ` +
  Object.keys(oauthParams)
    .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
    .concat(`oauth_signature="${encodeURIComponent(signature)}"`)
    .join(', ');

console.log('\nAuthorization Header (first 150 chars):');
console.log(authHeader.substring(0, 150) + '...');

// Make the request
console.log('\nMaking request to:', url);

fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': authHeader,
    'Accept': 'application/json'
  }
})
.then(async response => {
  console.log('\nResponse Status:', response.status);
  
  if (!response.ok) {
    const wwwAuth = response.headers.get('www-authenticate');
    if (wwwAuth) {
      console.log('WWW-Authenticate:', wwwAuth);
    }
    
    const responseText = await response.text();
    try {
      const error = JSON.parse(responseText);
      console.log('\nError Details:');
      console.log(JSON.stringify(error, null, 2));
      
      if (error.o?.errorDetails?.[0]?.detail) {
        console.log('\n⚠️  Error Message:', error.o.errorDetails[0].detail);
      }
    } catch {
      console.log('\nError Response:', responseText);
    }
  } else {
    console.log('\n✅ SUCCESS! Authentication is working!');
    const data = await response.json();
    console.log('Metadata catalog has', data.items?.length || 0, 'record types available');
  }
})
.catch(error => {
  console.error('\n❌ Request failed:', error.message);
});