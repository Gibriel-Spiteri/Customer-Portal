// Test OIDC login flow
import fetch from 'node-fetch';

async function testOIDCFlow() {
  console.log('Testing OIDC Login Flow...\n');

  try {
    // Test 1: Check OIDC status
    console.log('1. Checking OIDC configuration...');
    const statusResponse = await fetch('http://localhost:5000/api/auth/netsuite/oidc/status');
    const status = await statusResponse.json();
    console.log('   Status:', JSON.stringify(status, null, 2));
    
    if (!status.configured) {
      console.log('❌ OIDC is not configured properly');
      return;
    }
    
    // Test 2: Get authorization URL
    console.log('\n2. Getting authorization URL...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/netsuite/oidc/login');
    const loginData = await loginResponse.json();
    
    if (loginData.success) {
      console.log('✅ Authorization URL generated successfully');
      console.log('   URL:', loginData.authUrl);
      console.log('\n💡 To complete the test:');
      console.log('   1. Copy the URL above');
      console.log('   2. Open it in your browser');
      console.log('   3. Complete the NetSuite authentication');
      console.log('   4. You should be redirected back to the app');
    } else {
      console.log('❌ Failed to get authorization URL:', loginData.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testOIDCFlow();