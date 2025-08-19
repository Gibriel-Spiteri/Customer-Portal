import { NetSuiteM2M } from './server/services/netsuite-m2m.js';

async function testNonItemizedPRA() {
  const m2m = new NetSuiteM2M();
  
  try {
    const orderId = '6279369';
    
    const praQuery = `
      SELECT 
        pra.id AS praId,
        pra.name AS praNumber,
        pra.custrecord_txnpra_pracode AS praCode,
        pra.custrecord_txnpra_discrate AS discountRate,
        pra.custrecord_txnpra_pratype AS praType,
        CASE 
          WHEN pra.custrecord_txnpra_pratype = '3' THEN 'CRD Rebate Redemption'
          WHEN pra.custrecord_txnpra_pratype = '4' THEN 'Non-Itemized Promotion'
          WHEN pra.custrecord_txnpra_pratype = '5' THEN 'Free Delivery'
          WHEN pra.custrecord_txnpra_pratype = '2' THEN 'Header Promotion'
          ELSE 'Promotional Adjustment'
        END AS praDescription
      FROM 
        customrecord_txnpra pra
      WHERE 
        pra.custrecord_txnpra_txnid = ${orderId}
        AND pra.custrecord_txnpra_txntype = 'salesorder'
        AND pra.custrecord_txnpra_pratype != '1'
    `.trim();
    
    console.log('Testing non-itemized PRA query for order', orderId);
    const result = await m2m.executeSuiteQL(praQuery);
    console.log('\nNon-itemized PRA records (excluding pratype = 1):');
    console.log('Found:', result.items.length, 'records\n');
    
    result.items.forEach(pra => {
      console.log(`• ${pra.pradescription}`);
      console.log(`  PRA Code: ${pra.pracode}`);
      console.log(`  Amount: $${Math.abs(parseFloat(pra.discountrate)).toFixed(2)}`);
      console.log(`  Type: ${pra.pratype}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testNonItemizedPRA();
