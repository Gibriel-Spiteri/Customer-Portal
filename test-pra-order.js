import { NetSuiteM2M } from './server/services/netsuite-m2m.js';

async function testPRAForOrder() {
  const m2m = new NetSuiteM2M();
  
  try {
    const orderId = '6279369'; // Order SO708075
    
    // Test the updated PRA query
    const praQuery = `
      SELECT 
        pra.id AS praId,
        pra.name AS praNumber,
        pra.custrecord_txnpra_pracode AS praCode,
        pra.custrecord_txnpra_discrate AS discountRate,
        pra.custrecord_txnpra_pratype AS praType,
        pra.custrecord_txnpra_status AS praStatus,
        pra.custrecord_txnpra_txnid AS transactionId,
        pra.custrecord_txnpra_posted AS posted
      FROM 
        customrecord_txnpra pra
      WHERE 
        pra.custrecord_txnpra_txnid = ${orderId}
        AND pra.custrecord_txnpra_txntype = 'salesorder'
    `.trim();
    
    console.log('Testing PRA query for order', orderId);
    const result = await m2m.executeSuiteQL(praQuery);
    console.log('PRA records found:', result.items.length);
    console.log('PRA data:', JSON.stringify(result.items, null, 2));
    
    // Also let's check what line items have descriptions that match PRAs
    const lineQuery = `
      SELECT 
        transactionline.id AS lineId,
        transactionline.linesequencenumber AS lineNumber,
        BUILTIN.DF(transactionline.item) AS itemName,
        transactionline.memo AS description,
        transactionline.amount,
        transactionline.rate
      FROM 
        transactionline
      WHERE 
        transactionline.transaction = ${orderId}
        AND (
          transactionline.memo LIKE '%Hardware Credit%'
          OR transactionline.memo LIKE '%iLighting%'
          OR transactionline.memo LIKE '%Protection Plan%'
          OR transactionline.memo LIKE '%Double the Bundle%'
          OR transactionline.item IN (SELECT item FROM item WHERE displayname LIKE '%Discount%')
        )
      ORDER BY 
        transactionline.linesequencenumber
    `.trim();
    
    console.log('\nChecking line items with PRA-related descriptions...');
    const lineResult = await m2m.executeSuiteQL(lineQuery);
    console.log('Related line items:', JSON.stringify(lineResult.items, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testPRAForOrder();