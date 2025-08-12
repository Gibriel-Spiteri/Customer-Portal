import { NetSuiteM2M } from './server/services/netsuite-m2m.js';

async function checkCustomerEstimates(customerId) {
  try {
    console.log(`\nChecking estimates for customer ID: ${customerId}`);
    console.log('=' .repeat(60));
    
    const m2m = new NetSuiteM2M();
    
    // Get estimates for the specific customer
    const estimates = await m2m.getCustomerEstimates(customerId, 20);
    
    if (estimates.length === 0) {
      console.log(`\n❌ No estimates found for customer ID ${customerId}`);
    } else {
      console.log(`\n✅ Found ${estimates.length} estimate(s) for customer ID ${customerId}:\n`);
      
      estimates.forEach((estimate, index) => {
        console.log(`Estimate ${index + 1}:`);
        console.log(`  Document Number: ${estimate.documentnumber || estimate.documentNumber}`);
        console.log(`  Customer: ${estimate.customername || estimate.customerName}`);
        console.log(`  Date: ${estimate.date || estimate.trandate}`);
        console.log(`  Status: ${estimate.status}`);
        console.log(`  Memo: ${estimate.memo || 'N/A'}`);
        console.log(`  Expiry: ${estimate.expirationdate || estimate.expirationDate || 'N/A'}`);
        console.log('');
      });
    }
    
    return estimates;
  } catch (error) {
    console.error('\n❌ Error fetching customer estimates:', error.message);
    return [];
  }
}

// Check for customer ID 441667
checkCustomerEstimates('441667').then(() => {
  console.log('\nQuery complete.');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});