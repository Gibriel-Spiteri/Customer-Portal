import * as crypto from 'crypto';

// Detailed NetSuite authentication test
const config = {
  accountId: process.env.NETSUITE_ACCOUNT_ID?.match(/(\d+)\.app\.netsuite\.com/)?.[1] || process.env.NETSUITE_ACCOUNT_ID || "",
  consumerKey: process.env.NETSUITE_CONSUMER_KEY || "",
  consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || "",
  tokenId: process.env.NETSUITE_TOKEN_ID || "",
  tokenSecret: process.env.NETSUITE_TOKEN_SECRET || ""
};

console.log('=== NetSuite Authentication Test ===\n');

// Step 1: Verify credentials are present
console.log('Step 1: Checking credentials...');
const credentialsOk = config.consumerKey && config.consumerSecret && config.tokenId && config.tokenSecret;
console.log(`✓ Account ID: ${config.accountId}`);
console.log(`${config.consumerKey ? '✓' : '✗'} Consumer Key: ${config.consumerKey ? 'Present' : 'Missing'}`);
console.log(`${config.consumerSecret ? '✓' : '✗'} Consumer Secret: ${config.consumerSecret ? 'Present' : 'Missing'}`);
console.log(`${config.tokenId ? '✓' : '✗'} Token ID: ${config.tokenId ? 'Present' : 'Missing'}`);
console.log(`${config.tokenSecret ? '✓' : '✗'} Token Secret: ${config.tokenSecret ? 'Present' : 'Missing'}`);

if (!credentialsOk) {
  console.log('\n❌ Missing credentials. Cannot proceed with authentication test.');
  process.exit(1);
}

// Step 2: Test OAuth signature generation
console.log('\nStep 2: Testing OAuth signature generation...');

async function testOAuthSignature() {
  const method = 'GET';
  const baseUrl = `https://${config.accountId}.suitetalk.api.netsuite.com`;
  const endpoint = '/services/rest/record/v1/metadata-catalog';
  const url = baseUrl + endpoint;
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Try different signature methods
  const signatureMethods = ['HMAC-SHA256', 'HMAC-SHA1'];
  
  for (const signatureMethod of signatureMethods) {
    console.log(`\nTesting with ${signatureMethod}...`);
    
    const oauthParams = {
      oauth_consumer_key: config.consumerKey,
      oauth_token: config.tokenId,
      oauth_signature_method: signatureMethod,
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
    console.log('Signature base string:', signatureBase.substring(0, 100) + '...');
    
    // Generate signature
    const signingKey = `${config.consumerSecret}&${config.tokenSecret}`;
    const algorithm = signatureMethod === 'HMAC-SHA256' ? 'sha256' : 'sha1';
    const signature = crypto
      .createHmac(algorithm, signingKey)
      .update(signatureBase)
      .digest('base64');
    
    console.log('Generated signature:', signature.substring(0, 20) + '...');
    
    // Build OAuth header
    const authHeader = 'OAuth ' + 
      `realm="${config.accountId}", ` +
      Object.keys(oauthParams)
        .map(key => `${key}="${encodeURIComponent(oauthParams[key as keyof typeof oauthParams])}"`)
        .concat(`oauth_signature="${encodeURIComponent(signature)}"`)
        .join(', ');
    
    // Test the request
    console.log('Making request to:', url);
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.log('Response status:', response.status, response.statusText);
      
      if (response.status === 401) {
        const errorData = await response.json();
        console.log('Authentication error:', errorData.o?.errorDetails?.[0]?.detail || errorData);
        
        // Try to parse more specific error information
        if (errorData.o?.errorDetails?.[0]?.o?.errorCode) {
          console.log('Error code:', errorData.o.errorDetails[0].o.errorCode);
        }
      } else if (response.ok) {
        console.log('✓ Authentication successful with', signatureMethod);
        const data = await response.json();
        console.log('Response data available:', Object.keys(data));
        return true;
      } else {
        const text = await response.text();
        console.log('Other error:', text);
      }
    } catch (error) {
      console.error('Request failed:', error);
    }
  }
  
  return false;
}

// Step 3: Test with different API endpoints
console.log('\nStep 3: Testing different endpoints...');

async function testEndpoints() {
  const endpoints = [
    '/services/rest/record/v1/metadata-catalog',
    '/services/rest/record/v1/customer',
    '/services/rest/record/v1'
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\nTesting endpoint: ${endpoint}`);
    
    const method = 'GET';
    const baseUrl = `https://${config.accountId}.suitetalk.api.netsuite.com`;
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

    const paramString = Object.keys(oauthParams)
      .sort()
      .map(key => `${key}=${encodeURIComponent(oauthParams[key as keyof typeof oauthParams])}`)
      .join('&');
    
    const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${config.consumerSecret}&${config.tokenSecret}`;
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(signatureBase)
      .digest('base64');
    
    const authHeader = 'OAuth ' + 
      `realm="${config.accountId}", ` +
      Object.keys(oauthParams)
        .map(key => `${key}="${encodeURIComponent(oauthParams[key as keyof typeof oauthParams])}"`)
        .concat(`oauth_signature="${encodeURIComponent(signature)}"`)
        .join(', ');
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Response: ${response.status} ${response.statusText}`);
      
      if (response.status === 401) {
        const errorData = await response.json();
        console.log('Error:', errorData.o?.errorDetails?.[0]?.detail || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed:', error);
    }
  }
}

// Run all tests
async function runTests() {
  const signatureOk = await testOAuthSignature();
  
  if (!signatureOk) {
    await testEndpoints();
  }
  
  console.log('\n=== Summary ===');
  console.log('The authentication is failing at the OAuth signature verification stage.');
  console.log('NetSuite is returning "Invalid login attempt" errors.');
  console.log('\nPossible causes:');
  console.log('1. The Token ID/Secret pair might not match the Consumer Key/Secret pair');
  console.log('2. The user/role associated with the token might not have REST Web Services permission');
  console.log('3. The Integration Record might need to be re-enabled');
  console.log('4. There might be IP restrictions on the token');
}

runTests();