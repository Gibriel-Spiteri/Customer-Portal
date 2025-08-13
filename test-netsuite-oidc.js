// Test NetSuite OIDC configuration
import https from 'https';

async function testOIDCConfiguration() {
  console.log('Testing NetSuite OIDC Configuration...\n');

  // Test 1: Discover OIDC configuration
  try {
    const configResponse = await fetch('https://1212804.suitetalk.api.netsuite.com/.well-known/openid-configuration');
    
    if (!configResponse.ok) {
      console.error('❌ OIDC discovery failed:', configResponse.status, configResponse.statusText);
      return;
    }

    const config = await configResponse.json();
    console.log('✅ OIDC Configuration discovered successfully');
    console.log('   Issuer:', config.issuer);
    console.log('   Authorization Endpoint:', config.authorization_endpoint);
    console.log('   Token Endpoint:', config.token_endpoint);
    console.log('   UserInfo Endpoint:', config.userinfo_endpoint);
    console.log('   Supported Scopes:', config.scopes_supported?.join(', '));
    console.log('   Supported Response Types:', config.response_types_supported?.join(', '));
    console.log('   Supported Grant Types:', config.grant_types_supported?.join(', '));
    console.log();

    // Test 2: Check environment variables
    console.log('Environment Variables:');
    console.log('   NETSUITE_OIDC_CLIENT_ID:', process.env.NETSUITE_OIDC_CLIENT_ID ? 'Set ✅' : 'Not set ❌');
    console.log('   NETSUITE_OIDC_CLIENT_SECRET:', process.env.NETSUITE_OIDC_CLIENT_SECRET ? 'Set ✅' : 'Not set ❌');
    console.log();

    // Test 3: Test our OIDC service
    try {
      const response = await fetch('http://localhost:5000/api/auth/netsuite/oidc/status');
      const status = await response.json();
      
      console.log('OIDC Service Status:');
      console.log('   Configured:', status.configured ? '✅' : '❌');
      console.log('   Client ID:', status.clientId);
      console.log('   Client Secret:', status.clientSecret);
      console.log('   Redirect URI:', status.redirectUri);
      console.log('   Scope:', status.scope);
      console.log();

      if (status.configured) {
        console.log('🎉 NetSuite OIDC is ready to test!');
        console.log('💡 To test the full flow:');
        console.log('   1. Go to the login page');
        console.log('   2. Click on the Enterprise tab');
        console.log('   3. Click "Sign in with NetSuite"');
        console.log('   4. Complete the authentication flow');
      } else {
        console.log('⚠️  OIDC is not properly configured');
      }

    } catch (error) {
      console.error('❌ Failed to test OIDC service:', error.message);
    }

  } catch (error) {
    console.error('❌ OIDC discovery failed:', error.message);
  }
}

// Helper function for Node.js fetch
async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data)
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Run the test
testOIDCConfiguration().catch(console.error);