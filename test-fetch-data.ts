import { NetSuiteM2M } from './server/services/netsuite-m2m';

async function testFetchData() {
  try {
    const m2m = new NetSuiteM2M();
    
    console.log('Testing NetSuite data fetch...\n');
    
    // Test estimates
    console.log('=== FETCHING ESTIMATES ===');
    const estimatesResult = await m2m.getAllEstimates(5, 0);
    console.log(`Found ${estimatesResult.items.length} estimates\n`);
    
    if (estimatesResult.items.length > 0) {
      const firstEstimate = estimatesResult.items[0];
      console.log('First estimate raw data:');
      console.log(JSON.stringify(firstEstimate, null, 2));
      console.log('\nField names in first estimate:', Object.keys(firstEstimate));
      console.log('\nChecking total field variations:');
      console.log('  - total:', firstEstimate.total);
      console.log('  - Total:', (firstEstimate as any).Total);
      console.log('  - TOTAL:', (firstEstimate as any).TOTAL);
    }
    
    // Test specific customer's orders
    const customerId = '154129'; // gspiteri@consumersmail.com's ID
    console.log(`\n=== FETCHING ORDERS FOR CUSTOMER ${customerId} ===`);
    const orders = await m2m.getCustomerOrders(customerId, 5);
    console.log(`Found ${orders.length} orders\n`);
    
    if (orders.length > 0) {
      const firstOrder = orders[0];
      console.log('First order raw data:');
      console.log(JSON.stringify(firstOrder, null, 2));
      console.log('\nField names in first order:', Object.keys(firstOrder));
      console.log('\nChecking total field variations:');
      console.log('  - total:', firstOrder.total);
      console.log('  - Total:', (firstOrder as any).Total);
      console.log('  - TOTAL:', (firstOrder as any).TOTAL);
    }
    
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

testFetchData();