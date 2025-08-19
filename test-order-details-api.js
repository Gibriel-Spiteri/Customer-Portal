import fetch from 'node-fetch';

async function testOrderDetailsAPI() {
  try {
    console.log('Testing Order Details API with hardcoded order ID...\n');
    
    // Test with a known order ID from NetSuite
    // You can see order IDs in the browser network tab when loading the orders page
    const testOrderId = '1234'; // Replace with an actual order ID from your system
    
    // Get auth token from environment or use a test token
    const testToken = 'test'; // You'll need to replace this with a valid token
    
    console.log(`Testing /api/orders/${testOrderId} endpoint...`);
    
    const response = await fetch(`http://localhost:5000/api/orders/${testOrderId}`, {
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\nOrder Details Response:');
      console.log('- Order ID:', data.id);
      console.log('- Order Number:', data.orderNumber);
      console.log('- Total Amount:', data.totalAmount);
      console.log('- Has items field?:', 'items' in data);
      console.log('- Items count:', data.items?.length || 0);
      
      if (data.items && data.items.length > 0) {
        console.log('\nLine Items:');
        data.items.forEach((item, index) => {
          console.log(`  ${index + 1}. Item Name: ${item.itemName || item.name || 'N/A'}`);
          console.log(`     Quantity: ${item.quantity}, Rate: ${item.rate}, Amount: ${item.amount}`);
        });
      } else {
        console.log('\n⚠️  No items found in the response');
        console.log('Full response:', JSON.stringify(data, null, 2));
      }
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Also test the NetSuite M2M service directly
async function testNetSuiteM2M() {
  console.log('\n\nTesting NetSuite M2M Service directly...\n');
  
  try {
    const { NetSuiteM2M } = await import('./server/services/netsuite-m2m.js');
    const m2m = new NetSuiteM2M();
    
    // Test with a known order ID
    const testOrderId = '1234'; // Replace with actual order ID
    console.log(`Fetching order details for ID: ${testOrderId}`);
    
    const orderDetails = await m2m.getOrderDetails(testOrderId);
    
    console.log('\nNetSuite Response:');
    console.log('- Has lineItems?:', 'lineItems' in orderDetails);
    console.log('- LineItems count:', orderDetails.lineItems?.length || 0);
    
    if (orderDetails.lineItems && orderDetails.lineItems.length > 0) {
      console.log('\nLine Items from NetSuite:');
      orderDetails.lineItems.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.itemname || 'N/A'}`);
        console.log(`     Qty: ${item.quantity}, Rate: ${item.rate}, Amount: ${item.amount}`);
      });
    }
  } catch (error) {
    console.error('NetSuite M2M test failed:', error.message);
  }
}

// Run tests
console.log('='.repeat(50));
testOrderDetailsAPI().then(() => testNetSuiteM2M());