// Test NetSuite OIDC discovery
import * as client from 'openid-client';

async function testDiscovery() {
  console.log('Testing NetSuite OIDC Discovery...\n');
  
  try {
    const discoveryUrl = new URL('https://1212804.suitetalk.api.netsuite.com/.well-known/openid-configuration');
    const clientId = process.env.NETSUITE_OIDC_CLIENT_ID || 'test-client-id';
    const clientSecret = process.env.NETSUITE_OIDC_CLIENT_SECRET || 'test-client-secret';
    
    console.log('Discovery URL:', discoveryUrl.href);
    console.log('Client ID:', clientId ? 'Set' : 'Not set');
    console.log('Client Secret:', clientSecret ? 'Set' : 'Not set');
    console.log();
    
    const configuration = await client.discovery(discoveryUrl, clientId, clientSecret);
    
    console.log('Configuration type:', typeof configuration);
    console.log('Configuration keys:', Object.keys(configuration));
    
    if (configuration.serverMetadata) {
      console.log('\nServer Metadata:');
      console.log('  Issuer:', configuration.serverMetadata.issuer);
      console.log('  Authorization:', configuration.serverMetadata.authorization_endpoint);
      console.log('  Token:', configuration.serverMetadata.token_endpoint);
      console.log('  UserInfo:', configuration.serverMetadata.userinfo_endpoint);
    } else {
      console.log('\nNo serverMetadata found');
      console.log('Configuration:', JSON.stringify(configuration, null, 2));
    }
    
  } catch (error) {
    console.error('Discovery failed:', error);
  }
}

testDiscovery();