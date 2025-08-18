#!/usr/bin/env node

// Test support case statuses for different customers

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testCaseStatuses(customerId, customerName) {
  console.log(`\n====== Testing ${customerName} (${customerId}) ======`);
  
  try {
    // Login with demo credentials
    const loginResponse = await fetch(`${BASE_URL}/api/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId })
    });
    
    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      console.error('Login failed:', error.message);
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✓ Logged in successfully');
    
    // Fetch dashboard data
    const dashboardResponse = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!dashboardResponse.ok) {
      const error = await dashboardResponse.json();
      console.error('Dashboard fetch failed:', error.message);
      return;
    }
    
    const dashboard = await dashboardResponse.json();
    console.log(`\nDashboard shows: ${dashboard.totalCounts?.openCases || 0} open cases`);
    
    // Fetch all support cases
    const casesResponse = await fetch(`${BASE_URL}/api/support/cases`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (casesResponse.ok) {
      const allCases = await casesResponse.json();
      console.log(`\nTotal cases in system: ${allCases.length}`);
      
      // Show each case with its status
      console.log('\nCase Details:');
      allCases.forEach(c => {
        const statusDesc = c.status === '5' || c.status === 5 ? 'CLOSED' : 'OPEN';
        console.log(`  Case ${c.casenumber}: Status = ${c.status} (${statusDesc})`);
      });
      
      // Count open vs closed
      const openCases = allCases.filter(c => c.status !== '5' && c.status !== 5);
      const closedCases = allCases.filter(c => c.status === '5' || c.status === 5);
      
      console.log('\nSummary:');
      console.log(`  Open Cases: ${openCases.length}`);
      console.log(`  Closed Cases: ${closedCases.length}`);
      console.log(`  Dashboard Count Matches: ${dashboard.totalCounts?.openCases === openCases.length ? '✓ YES' : '✗ NO'}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function runTests() {
  console.log('====== Support Case Status Testing ======');
  
  // Test both demo customers
  await testCaseStatuses('441667', 'Baloga');
  await testCaseStatuses('154783', 'CRD');
  
  console.log('\n====== Test Complete ======');
}

// Run the tests
runTests().catch(console.error);