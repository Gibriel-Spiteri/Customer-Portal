#!/usr/bin/env node

// Test open cases count on dashboard

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testOpenCases() {
  console.log('====== Testing Open Cases Count on Dashboard ======\n');
  
  // Test with demo customer 441667 (Baloga)
  const customerId = '441667';
  console.log(`Testing with customer ${customerId}...`);
  
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
    console.log('\n--- Dashboard Metrics ---');
    console.log(`Open Cases: ${dashboard.totalCounts?.openCases || 0}`);
    console.log(`Recent Cases: ${dashboard.recentCases?.length || 0} cases shown`);
    
    // Check recent cases details
    if (dashboard.recentCases && dashboard.recentCases.length > 0) {
      console.log('\n--- Recent Cases Status Breakdown ---');
      const statusCount = {};
      dashboard.recentCases.forEach(caseItem => {
        const status = caseItem.status || 'Unknown';
        statusCount[status] = (statusCount[status] || 0) + 1;
        console.log(`Case ${caseItem.casenumber}: Status = ${status}`);
      });
      
      console.log('\n--- Status Summary ---');
      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`${status}: ${count} case(s)`);
      });
    }
    
    // Fetch all support cases to verify count
    const casesResponse = await fetch(`${BASE_URL}/api/support/cases`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (casesResponse.ok) {
      const allCases = await casesResponse.json();
      const openCases = allCases.filter(c => c.status !== '5' && c.status !== 5);
      const closedCases = allCases.filter(c => c.status === '5' || c.status === 5);
      
      console.log('\n--- Verification ---');
      console.log(`Total Cases: ${allCases.length}`);
      console.log(`Open Cases (status != 5): ${openCases.length}`);
      console.log(`Closed Cases (status = 5): ${closedCases.length}`);
      
      if (dashboard.totalCounts?.openCases === openCases.length) {
        console.log('✓ Dashboard shows correct open cases count!');
      } else {
        console.log(`✗ Dashboard shows ${dashboard.totalCounts?.openCases} but actual open cases are ${openCases.length}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n====== Test Complete ======');
}

// Run the test
testOpenCases().catch(console.error);