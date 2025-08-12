import fetch from 'node-fetch';

async function testNetSuiteFormLogin() {
  console.log('\n====== Testing NetSuite-Styled Form Login ======\n');
  
  // Test accounts
  const testAccounts = [
    {
      email: 'john.doe@baloga.com',
      password: 'Demo123!',
      expectedCompany: '104453 Baloga',
      expectedCustomerId: '441667',
      rememberMe: true
    },
    {
      email: 'crd.user@crdcompany.com',
      password: 'CRD2025!',
      expectedCompany: 'CRD Company',
      expectedCustomerId: '154783',
      rememberMe: false
    }
  ];
  
  // Test 1: Login with Remember Me enabled
  console.log('📋 Test 1: Baloga account with Remember Me');
  try {
    const response = await fetch('http://localhost:5000/api/auth/netsuite-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testAccounts[0].email,
        password: testAccounts[0].password,
        rememberMe: testAccounts[0].rememberMe
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login successful!');
      console.log('   User:', data.user.firstName, data.user.lastName);
      console.log('   Company:', data.user.companyName);
      console.log('   Customer ID:', data.user.netsuiteCustomerId);
      console.log('   Remember Me:', testAccounts[0].rememberMe ? 'Enabled (30-day token)' : 'Disabled (24-hour token)');
      console.log('   Success flag:', data.success);
    } else {
      const error = await response.json();
      console.error('❌ Login failed:', error.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n📋 Test 2: CRD account without Remember Me');
  try {
    const response = await fetch('http://localhost:5000/api/auth/netsuite-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testAccounts[1].email,
        password: testAccounts[1].password,
        rememberMe: testAccounts[1].rememberMe
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login successful!');
      console.log('   User:', data.user.firstName, data.user.lastName);
      console.log('   Company:', data.user.companyName);
      console.log('   Customer ID:', data.user.netsuiteCustomerId);
      console.log('   Remember Me:', testAccounts[1].rememberMe ? 'Enabled (30-day token)' : 'Disabled (24-hour token)');
      console.log('   Success flag:', data.success);
    } else {
      const error = await response.json();
      console.error('❌ Login failed:', error.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n📋 Test 3: Invalid credentials');
  try {
    const response = await fetch('http://localhost:5000/api/auth/netsuite-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'wrong@email.com',
        password: 'WrongPassword',
        rememberMe: false
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log('✅ Correctly rejected invalid credentials');
      console.log('   Success flag:', error.success);
      console.log('   Error message:', error.message);
    } else {
      console.error('❌ Should have rejected invalid credentials');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n====== NetSuite Form Login Tests Complete ======\n');
  console.log('📌 Access the NetSuite-styled login form at:');
  console.log('   http://localhost:5000/netsuite-customer-login.html');
  console.log('');
  console.log('📌 Test Accounts:');
  console.log('   1. john.doe@baloga.com / Demo123!');
  console.log('   2. crd.user@crdcompany.com / CRD2025!');
  console.log('');
  console.log('📌 Features:');
  console.log('   - NetSuite branding and styling');
  console.log('   - Remember Me checkbox (30-day vs 24-hour tokens)');
  console.log('   - Email validation');
  console.log('   - Password reset link');
}

testNetSuiteFormLogin();