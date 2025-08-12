import fetch from 'node-fetch';

async function testCustomLogin() {
  console.log('\n====== Testing Custom Login Feature ======\n');
  
  // Test accounts
  const testAccounts = [
    {
      email: 'john.doe@baloga.com',
      password: 'Demo123!',
      expectedCompany: '104453 Baloga',
      expectedCustomerId: '441667'
    },
    {
      email: 'crd.user@crdcompany.com',
      password: 'CRD2025!',
      expectedCompany: 'CRD Company',
      expectedCustomerId: '154783'
    }
  ];
  
  // Test 1: Valid login for Baloga account
  console.log('📧 Test 1: Valid login for Baloga account');
  try {
    const response = await fetch('http://localhost:5000/api/auth/custom-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testAccounts[0].email,
        password: testAccounts[0].password
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login successful!');
      console.log('   User:', data.user.firstName, data.user.lastName);
      console.log('   Company:', data.user.companyName);
      console.log('   Customer ID:', data.user.netsuiteCustomerId);
      console.log('   Token generated:', data.token ? 'Yes' : 'No');
    } else {
      const error = await response.json();
      console.error('❌ Login failed:', error.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n📧 Test 2: Valid login for CRD account');
  try {
    const response = await fetch('http://localhost:5000/api/auth/custom-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testAccounts[1].email,
        password: testAccounts[1].password
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login successful!');
      console.log('   User:', data.user.firstName, data.user.lastName);
      console.log('   Company:', data.user.companyName);
      console.log('   Customer ID:', data.user.netsuiteCustomerId);
      console.log('   Token generated:', data.token ? 'Yes' : 'No');
    } else {
      const error = await response.json();
      console.error('❌ Login failed:', error.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n📧 Test 3: Invalid password');
  try {
    const response = await fetch('http://localhost:5000/api/auth/custom-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testAccounts[0].email,
        password: 'WrongPassword'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log('✅ Correctly rejected invalid password:', error.message);
    } else {
      console.error('❌ Should have rejected invalid password');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n📧 Test 4: Invalid email');
  try {
    const response = await fetch('http://localhost:5000/api/auth/custom-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid@example.com',
        password: 'SomePassword'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log('✅ Correctly rejected invalid email:', error.message);
    } else {
      console.error('❌ Should have rejected invalid email');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n====== Custom Login Tests Complete ======\n');
  console.log('Test Accounts for UI Testing:');
  console.log('1. Email: john.doe@baloga.com');
  console.log('   Password: Demo123!');
  console.log('   (Baloga customer 441667)');
  console.log('');
  console.log('2. Email: crd.user@crdcompany.com');
  console.log('   Password: CRD2025!');
  console.log('   (CRD customer 154783)');
}

testCustomLogin();