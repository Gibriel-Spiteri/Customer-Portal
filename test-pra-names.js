import { NetSuiteM2M } from './server/services/netsuite-m2m.js';

async function testPRANames() {
  const m2m = new NetSuiteM2M();
  
  try {
    // First, let's explore what fields are available in the customrecord_txnpra table
    const exploreQuery = `
      SELECT 
        *
      FROM 
        customrecord_txnpra pra
      WHERE 
        pra.custrecord_txnpra_txnid = 6279369
        AND pra.custrecord_txnpra_txntype = 'salesorder'
        AND ROWNUM <= 1
    `.trim();
    
    console.log('Exploring all fields in customrecord_txnpra table:');
    const exploreResult = await m2m.executeSuiteQL(exploreQuery);
    if (exploreResult.items.length > 0) {
      console.log('Available fields:', Object.keys(exploreResult.items[0]));
      console.log('\nSample record:');
      console.log(JSON.stringify(exploreResult.items[0], null, 2));
    }
    
    // Also try to find a PRA code lookup table
    const lookupQuery = `
      SELECT 
        pra.custrecord_txnpra_pracode AS praCode,
        BUILTIN.DF(pra.custrecord_txnpra_pracode) AS praCodeName
      FROM 
        customrecord_txnpra pra
      WHERE 
        pra.custrecord_txnpra_txnid = 6279369
        AND pra.custrecord_txnpra_txntype = 'salesorder'
    `.trim();
    
    console.log('\n\nTrying to get PRA code display names:');
    const lookupResult = await m2m.executeSuiteQL(lookupQuery);
    console.log('Results:', JSON.stringify(lookupResult.items, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testPRANames();
