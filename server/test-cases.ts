#!/usr/bin/env tsx
// Test script to check NetSuite support cases

import { NetSuiteM2M } from './services/netsuite-m2m';

async function testCases() {
  console.log('Testing NetSuite support cases...');
  
  try {
    const m2m = new NetSuiteM2M();
    const customerId = '154129'; // James Baloga Jr's customer ID
    
    // Test fetching support cases
    console.log(`\nFetching support cases for customer ${customerId}...`);
    const cases = await m2m.getCustomerCases(customerId, 10);
    
    console.log(`Found ${cases.length} support cases`);
    
    if (cases.length > 0) {
      console.log('\nFirst case details:');
      console.log(JSON.stringify(cases[0], null, 2));
    }
    
    // Try a simpler query to see if there are ANY cases in the system
    const anyQuery = `
      SELECT 
        supportcase.id,
        supportcase.casenumber,
        supportcase.title,
        supportcase.company
      FROM 
        supportcase
      WHERE 
        ROWNUM <= 5
      ORDER BY 
        supportcase.createddate DESC
    `.trim();
    
    console.log('\n\nChecking for ANY support cases in the system...');
    const result = await m2m.executeSuiteQL(anyQuery, 5, 0);
    console.log(`Found ${result.items.length} cases in the system`);
    
    if (result.items.length > 0) {
      console.log('\nSample cases:');
      result.items.forEach((item: any) => {
        console.log(`- Case #${item.casenumber}: ${item.title} (Company: ${item.company})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing cases:', error);
    process.exit(1);
  }
}

// Run the test
testCases();