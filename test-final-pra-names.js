import { NetSuiteM2M } from './server/services/netsuite-m2m.js';

async function testFinalPRANames() {
  const m2m = new NetSuiteM2M();
  
  try {
    const orderId = '6279369';
    
    const praQuery = `
      SELECT 
        pra.id AS praId,
        pra.name AS praNumber,
        pra.custrecord_txnpra_pracode AS praCode,
        BUILTIN.DF(pra.custrecord_txnpra_pracode) AS praCodeName,
        pra.custrecord_txnpra_discrate AS discountRate,
        pra.custrecord_txnpra_pratype AS praType,
        CASE 
          WHEN pra.custrecord_txnpra_pracode = '11' THEN 'CRD REBATE REDEMPTION'
          WHEN pra.custrecord_txnpra_pracode = '372' THEN 'Limited Time Spring Into Savings Promo'
          ELSE BUILTIN.DF(pra.custrecord_txnpra_pracode)
        END AS praDescription
      FROM 
        customrecord_txnpra pra
      WHERE 
        pra.custrecord_txnpra_txnid = ${orderId}
        AND pra.custrecord_txnpra_txntype = 'salesorder'
        AND pra.custrecord_txnpra_pratype != '1'
    `.trim();
    
    console.log('Testing PRA query with NetSuite names for order', orderId);
    const result = await m2m.executeSuiteQL(praQuery);
    console.log('\nPRA records with proper names:');
    console.log('Found:', result.items.length, 'records\n');
    
    let total = 0;
    result.items.forEach(pra => {
      const amount = Math.abs(parseFloat(pra.discountrate));
      total += amount;
      console.log(`• ${pra.pradescription}`);
      console.log(`  PRA Code: ${pra.pracode}`);
      if (pra.pracode === '372') {
        console.log(`  Discount: 5% Off`);
      }
      console.log(`  Amount: $${amount.toFixed(2)}`);
      console.log('');
    });
    
    console.log(`Total Customer Discount: $${total.toFixed(2)}`);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testFinalPRANames();
