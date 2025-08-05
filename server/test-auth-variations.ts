import * as crypto from 'crypto';

// Test different authentication variations
const accountIdFromEnv = process.env.NETSUITE_ACCOUNT_ID || "";
const accountIdExtracted = accountIdFromEnv.match(/(\d+)\.app\.netsuite\.com/)?.[1] || accountIdFromEnv;

console.log('Testing NetSuite authentication variations...\n');
console.log('Original NETSUITE_ACCOUNT_ID:', accountIdFromEnv);
console.log('Extracted account ID:', accountIdExtracted);

const config = {
  consumerKey: process.env.NETSUITE_CONSUMER_KEY || "",
  consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || "",
  tokenId: process.env.NETSUITE_TOKEN_ID || "",
  tokenSecret: process.env.NETSUITE_TOKEN_SECRET || ""
};

async function testAuthVariation(accountId: string, includeRealm: boolean, description: string) {
  console.log(`\n${description}`);
  console.log(`Account ID: ${accountId}, Include realm: ${includeRealm}`);
  
  const method = 'GET';
  const baseUrl = `https://${accountId}.suitetalk.api.netsuite.com`;
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
  let authHeader = 'OAuth ';
  if (includeRealm) {
    authHeader += `realm="${accountId}", `;
  }
  authHeader += Object.keys(oauthParams)
    .map(key => `${key}="${encodeURIComponent(oauthParams[key as keyof typeof oauthParams])}"`)
    .concat(`oauth_signature="${encodeURIComponent(signature)}"`)
    .join(', ');
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('Response:', response.status, response.statusText);
    
    if (response.ok) {
      console.log('✓ SUCCESS! This configuration works.');
      return true;
    } else if (response.status === 401) {
      const errorData = await response.json();
      console.log('Error:', errorData.o?.errorDetails?.[0]?.detail || 'Unknown error');
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
  
  return false;
}

async function runTests() {
  // Test variations
  const variations = [
    { accountId: accountIdExtracted, includeRealm: true, desc: 'Test 1: Numeric account ID with realm' },
    { accountId: accountIdExtracted, includeRealm: false, desc: 'Test 2: Numeric account ID without realm' },
    { accountId: accountIdExtracted + '_SB1', includeRealm: true, desc: 'Test 3: Account ID with _SB1 suffix (sandbox) with realm' },
    { accountId: accountIdExtracted + '_SB1', includeRealm: false, desc: 'Test 4: Account ID with _SB1 suffix (sandbox) without realm' },
    { accountId: accountIdExtracted.toUpperCase(), includeRealm: true, desc: 'Test 5: Uppercase account ID with realm' },
  ];
  
  for (const variant of variations) {
    const success = await testAuthVariation(variant.accountId, variant.includeRealm, variant.desc);
    if (success) {
      console.log('\n✓ Found working configuration!');
      break;
    }
  }
  
  console.log('\n=== Additional Checks ===');
  console.log('\nPlease verify in NetSuite:');
  console.log('1. The Integration Record that generated the Consumer Key/Secret is ENABLED');
  console.log('2. The Access Token is linked to the same Integration Record');
  console.log('3. The user/role has these permissions:');
  console.log('   - Setup > REST Web Services');
  console.log('   - Lists > REST Record Resources');
  console.log('4. Check the Login Audit Trail for more details about the failed attempts');
}

runTests();