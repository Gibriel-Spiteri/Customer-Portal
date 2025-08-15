#!/usr/bin/env tsx
// Simple test to check what transactions exist for the customer

import { NetSuiteM2M } from './services/netsuite-m2m';

async function testSimplePayments() {
  console.log('Testing NetSuite transactions...');
  
  try {
    const m2m = new NetSuiteM2M();
    const customerId = '154129'; // James Baloga Jr's customer ID
    
    // Try a simple query to see any transactions for this customer
    const query = `
      SELECT 
        transaction.id,
        transaction.tranid,
        transaction.trandate,
        transaction.total,
        transaction.type
      FROM 
        transaction
      WHERE 
        transaction.entity = ${customerId}
        AND ROWNUM <= 10
      ORDER BY 
        transaction.trandate DESC
    `.trim();
    
    console.log('\nFetching transactions for customer', customerId);
    const result = await m2m.executeSuiteQL(query, 10, 0);
    console.log(`Found ${result.items.length} transactions`);
    
    if (result.items.length > 0) {
      console.log('\nTransactions:');
      result.items.forEach((item: any) => {
        console.log(`- Type: ${item.type}, ID: ${item.tranid}, Date: ${item.trandate}, Amount: ${item.total}`);
      });
    }
    
    // Also try to find ANY payments in the system to understand the structure
    const anyPaymentsQuery = `
      SELECT 
        transaction.id,
        transaction.tranid,
        transaction.trandate,
        transaction.total,
        transaction.type,
        transaction.entity
      FROM 
        transaction
      WHERE 
        transaction.type = 'CustPymt'
        AND ROWNUM <= 5
      ORDER BY 
        transaction.trandate DESC
    `.trim();
    
    console.log('\n\nFetching ANY payment transactions in the system...');
    const anyPayments = await m2m.executeSuiteQL(anyPaymentsQuery, 5, 0);
    console.log(`Found ${anyPayments.items.length} payment transactions in the system`);
    
    if (anyPayments.items.length > 0) {
      console.log('\nSample payment structure:');
      console.log(JSON.stringify(anyPayments.items[0], null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the test
testSimplePayments();