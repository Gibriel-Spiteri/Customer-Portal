const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

console.log('=== NetSuite M2M JWT Verification Test ===\n');

// Load the private key
const privateKey = fs.readFileSync('netsuite_private_key.pem', 'utf8');
const certificate = fs.readFileSync('netsuite_certificate.pem', 'utf8');

// Configuration from environment
const consumerKey = process.env.NETSUITE_CONSUMER_KEY || '4b3c88a85bdd1459e1c04434dba56fd92f96184c1a87655846e8f4b0b925341d';
const certificateId = process.env.NETSUITE_CERTIFICATE_ID || 'YmPJCW5cqaLXXL85kNfuFswDtic5XcNYhwgbB7WpLrU';
const accountId = '1212804';
const tokenUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;

console.log('Configuration:');
console.log('- Account ID:', accountId);
console.log('- Consumer Key:', consumerKey);
console.log('- Certificate ID:', certificateId);
console.log('- Token URL:', tokenUrl);
console.log();

// Generate JWT
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: consumerKey,
  scope: 'rest_webservices',
  aud: tokenUrl,
  exp: now + 300,
  iat: now
};

console.log('JWT Payload:', JSON.stringify(payload, null, 2));
console.log();

// Sign the JWT
const token = jwt.sign(payload, privateKey, {
  algorithm: 'RS256',
  header: {
    typ: 'JWT',
    alg: 'RS256',
    kid: certificateId
  }
});

console.log('Generated JWT Token (first 100 chars):');
console.log(token.substring(0, 100) + '...');
console.log();

// Verify the JWT with the public key from certificate
try {
  // Extract public key from certificate
  const publicKey = crypto.createPublicKey(certificate);
  
  // Verify the token
  const decoded = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    complete: true
  });
  
  console.log('✅ JWT signature verification: PASSED');
  console.log('Decoded JWT Header:', JSON.stringify(decoded.header, null, 2));
  console.log('Decoded JWT Payload:', JSON.stringify(decoded.payload, null, 2));
} catch (error) {
  console.log('❌ JWT signature verification: FAILED');
  console.log('Error:', error.message);
}

console.log('\n=== Certificate Information ===\n');

// Parse certificate details
const certLines = certificate.split('\n');
const certBody = certLines.slice(1, -2).join('');
const certBuffer = Buffer.from(certBody, 'base64');

// Get certificate info using openssl command
const { execSync } = require('child_process');
try {
  const certInfo = execSync('openssl x509 -in netsuite_certificate.pem -text -noout | head -20', { encoding: 'utf8' });
  console.log('Certificate Details:');
  console.log(certInfo);
} catch (error) {
  console.log('Could not get certificate details');
}

console.log('\n=== Making Test Request to NetSuite ===\n');

// Make actual request
async function testNetSuiteAuth() {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: token
  });

  console.log('Request body parameters:');
  console.log('- grant_type: client_credentials');
  console.log('- client_assertion_type: urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
  console.log('- client_assertion: [JWT token of length ' + token.length + ']');
  console.log();

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    const responseText = await response.text();
    
    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('Response Body:', responseText);
    
    if (!response.ok) {
      console.log('\n❌ Authentication failed');
      
      // Try to parse error
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error_description) {
          console.log('Error Description:', errorData.error_description);
        }
      } catch (e) {}
    } else {
      console.log('\n✅ Authentication successful!');
    }
  } catch (error) {
    console.log('Request Error:', error.message);
  }
}

testNetSuiteAuth();