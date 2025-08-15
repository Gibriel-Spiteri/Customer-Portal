#!/usr/bin/env tsx
// Test script to fetch payments from NetSuite

import { NetSuiteM2M } from './services/netsuite-m2m';

async function testPayments() {
  console.log('Testing NetSuite payment fetching...');
  
  try {
    const m2m = new NetSuiteM2M();
    const customerId = '154129'; // James Baloga Jr's customer ID
    
    // Test fetching payments
    console.log(`\nFetching payments for customer ${customerId}...`);
    const payments = await m2m.getCustomerPayments(customerId, 10);
    
    console.log(`Found ${payments.length} payments`);
    
    if (payments.length > 0) {
      console.log('\nFirst payment details:');
      console.log(JSON.stringify(payments[0], null, 2));
    }
    
    // Try a broader query to see what transaction types exist for this customer
    const query = `
      SELECT DISTINCT
        transaction.type,
        COUNT(*) as count
      FROM 
        transaction
      WHERE 
        transaction.entity = ${customerId}
      GROUP BY 
        transaction.type
      ORDER BY 
        COUNT(*) DESC
    `.trim();
    
    console.log('\n\nChecking all transaction types for this customer...');
    const result = await m2m.executeSuiteQL(query, 20, 0);
    console.log('Transaction types:', result.items);
    
    // Try fetching any payment-related transactions
    const paymentQuery = `
      SELECT 
        transaction.id,
        transaction.tranid,
        transaction.trandate,
        transaction.total,
        transaction.type,
        transaction.memo,
        BUILTIN.DF(transaction.type) AS typeText
      FROM 
        transaction
      WHERE 
        transaction.entity = ${customerId}
        AND (transaction.type = 'CustPymt' 
             OR transaction.type = 'Payment' 
             OR transaction.type = 'CustDep'
             OR transaction.type = 'CashSale')
      ORDER BY 
        transaction.trandate DESC
    `.trim();
    
    console.log('\n\nFetching all payment-related transactions...');
    const paymentResult = await m2m.executeSuiteQL(paymentQuery, 10, 0);
    console.log(`Found ${paymentResult.items.length} payment-related transactions`);
    
    if (paymentResult.items.length > 0) {
      console.log('\nPayment transactions:');
      paymentResult.items.forEach((item: any, index: number) => {
        console.log(`\n${index + 1}. Type: ${item.type} (${item.typeText})`);
        console.log(`   ID: ${item.id}, TranID: ${item.tranid}`);
        console.log(`   Date: ${item.trandate}, Amount: ${item.total}`);
        console.log(`   Memo: ${item.memo || 'N/A'}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing payments:', error);
    process.exit(1);
  }
}

// Run the test
testPayments();