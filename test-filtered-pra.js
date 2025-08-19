import { NetSuiteM2M } from './server/services/netsuite-m2m.js';

async function testFilteredPRA() {
  const m2m = new NetSuiteM2M();
  
  try {
    const orderId = '6279369';
    
    const praQuery = `
      SELECT 
        transactionline.id AS lineId,
        BUILTIN.DF(transactionline.item) AS itemName,
        transactionline.memo AS description,
        transactionline.amount,
        transactionline.rate
      FROM 
        transactionline
      WHERE 
        transactionline.transaction = ${orderId}
        AND transactionline.item IS NOT NULL
        AND transactionline.item != 3620
        AND transactionline.rate < 0
        AND transactionline.amount > 0
        AND (transactionline.memo NOT LIKE '%We Pay%' OR transactionline.memo IS NULL)
        AND (BUILTIN.DF(transactionline.item) NOT LIKE '%We Pay%' OR BUILTIN.DF(transactionline.item) IS NULL)
      ORDER BY 
        transactionline.linesequencenumber
    `.trim();
    
    console.log('Testing filtered PRA query for order', orderId);
    const result = await m2m.executeSuiteQL(praQuery);
    console.log('\nPromotional items after filtering (excluding "We Pay the Tax"):');
    console.log('Found:', result.items.length, 'items\n');
    
    result.items.forEach(item => {
      console.log(`• ${item.itemname}`);
      console.log(`  Description: ${item.description || 'No description'}`);
      console.log(`  Amount: $${Math.abs(parseFloat(item.amount)).toFixed(2)}\n`);
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testFilteredPRA();
