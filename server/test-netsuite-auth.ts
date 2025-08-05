import * as crypto from 'crypto';

// Test NetSuite authentication
const config = {
  accountId: process.env.NETSUITE_ACCOUNT_ID?.match(/(\d+)\.app\.netsuite\.com/)?.[1] || process.env.NETSUITE_ACCOUNT_ID || "",
  consumerKey: process.env.NETSUITE_CONSUMER_KEY || "",
  consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || "",
  tokenId: process.env.NETSUITE_TOKEN_ID || "",
  tokenSecret: process.env.NETSUITE_TOKEN_SECRET || ""
};

console.log('NetSuite Auth Test Configuration:');
console.log('Account ID:', config.accountId);
console.log('Consumer Key:', config.consumerKey ? 'Set (length: ' + config.consumerKey.length + ')' : 'Not set');
console.log('Consumer Secret:', config.consumerSecret ? 'Set (length: ' + config.consumerSecret.length + ')' : 'Not set');
console.log('Token ID:', config.tokenId ? 'Set (length: ' + config.tokenId.length + ')' : 'Not set');
console.log('Token Secret:', config.tokenSecret ? 'Set (length: ' + config.tokenSecret.length + ')' : 'Not set');

// Test a simple API call to verify authentication
async function testAuth() {
  const method = 'GET';
  const baseUrl = `https://${config.accountId}.suitetalk.api.netsuite.com`;
  const endpoint = '/services/rest/record/v1/metadata-catalog';
  const url = baseUrl + endpoint;
  
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

  // Create signature base string
  const paramString = Object.keys(oauthParams)
    .sort()
    .map(key => `${key}=${encodeURIComponent(oauthParams[key as keyof typeof oauthParams])}`)
    .join('&');
  
  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  
  // Generate signature
  const signingKey = `${config.consumerSecret}&${config.tokenSecret}`;
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(signatureBase)
    .digest('base64');
  
  // Build OAuth header
  const authHeader = 'OAuth ' + 
    `realm="${config.accountId}", ` +
    Object.keys(oauthParams)
      .map(key => `${key}="${encodeURIComponent(oauthParams[key as keyof typeof oauthParams])}"`)
      .concat(`oauth_signature="${encodeURIComponent(signature)}"`)
      .join(', ');
  
  console.log('\nTesting API call to:', url);
  console.log('Auth header (truncated):', authHeader.substring(0, 100) + '...');
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('\nResponse status:', response.status, response.statusText);
    
    if (!response.ok) {
      const text = await response.text();
      console.log('Error response:', text);
    } else {
      console.log('Success! Authentication is working.');
      const data = await response.json();
      console.log('Response preview:', JSON.stringify(data).substring(0, 200) + '...');
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testAuth();