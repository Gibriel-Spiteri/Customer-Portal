#!/usr/bin/env node

// Test customer status access control

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testCustomerStatusAccess() {
  console.log('====== Testing Customer Status Access Control ======\n');
  
  // Test with CRD customer (154783) - should be Active
  console.log('Testing with CRD customer (154783)...');
  
  try {
    // First login to get a token
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'crd@primepoultry.com',
        password: 'CRD2024secure!'
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (loginResponse.ok) {
      console.log('✓ CRD customer login successful (Active status allows access)');
      console.log(`  Customer ID: ${loginData.user.netsuiteCustomerId}`);
      
      // Test accessing protected endpoints with the token
      const token = loginData.token;
      
      // Test dashboard access
      const dashboardResponse = await fetch(`${BASE_URL}/api/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (dashboardResponse.ok) {
        console.log('✓ Dashboard access successful for Active customer');
      } else {
        const error = await dashboardResponse.json();
        console.log(`✗ Dashboard access blocked: ${error.message}`);
      }
      
      // Test account info access
      const accountResponse = await fetch(`${BASE_URL}/api/account`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        console.log('✓ Account access successful for Active customer');
        console.log(`  Customer Status: ${accountData.customerStatus || 'Not specified (defaults to Active)'}`);
      } else {
        const error = await accountResponse.json();
        console.log(`✗ Account access blocked: ${error.message}`);
      }
      
    } else {
      console.log(`✗ Login failed: ${loginData.message}`);
      if (loginData.statusCode) {
        console.log(`  Status Code: ${loginData.statusCode}`);
      }
    }
    
  } catch (error) {
    console.error('Error testing CRD customer:', error.message);
  }
  
  console.log('\n-----------------------------------\n');
  
  // Test registration with different customer statuses
  console.log('Testing registration with various customer statuses...');
  console.log('(This would require test customers with different statuses in NetSuite)');
  
  // Example test for a customer on Global Hold (status 2)
  console.log('\nSimulating Global Hold status check:');
  console.log('  Expected: "Your Account is on Hold. Speak to a Store Manager for more information."');
  
  // Example test for a Discontinued customer (status 3)
  console.log('\nSimulating Discontinued status check:');
  console.log('  Expected: "Your Account has been discontinued."');
  
  // Example test for a Contact Hold customer (status 7)
  console.log('\nSimulating Contact Hold status check:');
  console.log('  Expected: "Your Account is on Contact Hold. Please contact support for assistance."');
  
  console.log('\n====== Customer Status Access Control Test Complete ======');
}

// Run the test
testCustomerStatusAccess().catch(console.error);