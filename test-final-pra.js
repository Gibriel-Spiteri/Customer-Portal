import { NetSuiteM2M } from './server/services/netsuite-m2m.js';

async function testFinalPRA() {
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
      ORDER BY 
        transactionline.linesequencenumber
    `.trim();
    
    console.log('Testing final PRA query for order', orderId);
    const result = await m2m.executeSuiteQL(praQuery);
    console.log('Promotional items found:', result.items.length);
    console.log('Promotional items data:');
    result.items.forEach(item => {
      console.log(`  - ${item.itemname}: ${item.description || 'No description'} (Amount: ${item.amount})`);
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testFinalPRA();
