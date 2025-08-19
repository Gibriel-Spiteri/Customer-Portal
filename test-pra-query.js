import { NetSuiteM2M } from './server/services/netsuite-m2m.js';

async function testPRAQuery() {
  const m2m = new NetSuiteM2M();
  
  try {
    // Test the PRA query directly
    const orderId = '6279369'; // Order SO708075
    
    // First, let's try a simpler query to see what tables exist
    const testQuery1 = `
      SELECT 
        *
      FROM 
        customrecord_txnpra
      WHERE 
        ROWNUM <= 5
    `.trim();
    
    console.log('Testing if customrecord_txnpra table exists...');
    try {
      const result1 = await m2m.executeSuiteQL(testQuery1);
      console.log('Table exists! Sample data:', JSON.stringify(result1, null, 2));
    } catch (error) {
      console.log('Table customrecord_txnpra might not exist or has different structure');
      console.log('Error:', error.message);
    }
    
    // Try to find PRA mapping table
    const testQuery2 = `
      SELECT 
        *
      FROM 
        customrecord_transaction_pra_map
      WHERE 
        ROWNUM <= 5
    `.trim();
    
    console.log('\nTesting if customrecord_transaction_pra_map table exists...');
    try {
      const result2 = await m2m.executeSuiteQL(testQuery2);
      console.log('Mapping table exists! Sample data:', JSON.stringify(result2, null, 2));
    } catch (error) {
      console.log('Mapping table might not exist');
      console.log('Error:', error.message);
    }
    
    // Let's also check what custom fields exist on the transaction line
    const testQuery3 = `
      SELECT 
        transactionline.*
      FROM 
        transactionline
      WHERE 
        transactionline.transaction = ${orderId}
        AND transactionline.item = 3620
    `.trim();
    
    console.log('\nChecking Customer Discount line for any PRA-related fields...');
    try {
      const result3 = await m2m.executeSuiteQL(testQuery3);
      console.log('Customer Discount line data:', JSON.stringify(result3, null, 2));
    } catch (error) {
      console.log('Error fetching line data:', error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testPRAQuery();