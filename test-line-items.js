import fetch from 'node-fetch';

async function testLineItems() {
  try {
    // First, get a test token by logging in
    console.log('Testing Order and Estimate Line Items...\n');
    
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'baloga@crdind.com',
        password: 'changeme123'
      })
    });

    if (!loginResponse.ok) {
      console.error('Login failed:', await loginResponse.text());
      return;
    }

    const { token } = await loginResponse.json();
    console.log('✓ Logged in successfully\n');

    // Test fetching orders
    console.log('1. Fetching Orders List...');
    const ordersResponse = await fetch('http://localhost:5000/api/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (ordersResponse.ok) {
      const orders = await ordersResponse.json();
      console.log(`Found ${orders.length} orders`);
      
      if (orders.length > 0) {
        const firstOrder = orders[0];
        console.log(`\n2. Fetching details for Order ${firstOrder.orderNumber} (ID: ${firstOrder.id})...`);
        
        const orderDetailsResponse = await fetch(`http://localhost:5000/api/orders/${firstOrder.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (orderDetailsResponse.ok) {
          const orderDetails = await orderDetailsResponse.json();
          console.log('\nOrder Details:');
          console.log('- Order Number:', orderDetails.orderNumber);
          console.log('- Total Amount:', orderDetails.totalAmount);
          console.log('- Line Items:', orderDetails.items?.length || 0);
          
          if (orderDetails.items && orderDetails.items.length > 0) {
            console.log('\nLine Items Found:');
            orderDetails.items.forEach((item, index) => {
              console.log(`  ${index + 1}. ${item.itemName || item.name || 'Unnamed Item'}`);
              console.log(`     Qty: ${item.quantity}, Rate: ${item.rate}, Amount: ${item.amount}`);
            });
          } else {
            console.log('⚠️  No line items found in order details');
          }
        } else {
          console.error('Failed to fetch order details:', await orderDetailsResponse.text());
        }
      }
    } else {
      console.error('Failed to fetch orders:', await ordersResponse.text());
    }

    // Test fetching estimates
    console.log('\n3. Fetching Estimates List...');
    const estimatesResponse = await fetch('http://localhost:5000/api/estimates', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (estimatesResponse.ok) {
      const estimates = await estimatesResponse.json();
      console.log(`Found ${estimates.length} estimates`);
      
      if (estimates.length > 0) {
        const firstEstimate = estimates[0];
        console.log(`\n4. Fetching details for Estimate ${firstEstimate.estimateNumber} (ID: ${firstEstimate.id})...`);
        
        const estimateDetailsResponse = await fetch(`http://localhost:5000/api/estimates/${firstEstimate.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (estimateDetailsResponse.ok) {
          const estimateDetails = await estimateDetailsResponse.json();
          console.log('\nEstimate Details:');
          console.log('- Estimate Number:', estimateDetails.estimateNumber);
          console.log('- Total Amount:', estimateDetails.amount || estimateDetails.totalAmount);
          console.log('- Line Items:', estimateDetails.items?.length || 0);
          
          if (estimateDetails.items && estimateDetails.items.length > 0) {
            console.log('\nLine Items Found:');
            estimateDetails.items.forEach((item, index) => {
              console.log(`  ${index + 1}. ${item.itemName || item.name || 'Unnamed Item'}`);
              console.log(`     Qty: ${item.quantity}, Rate: ${item.rate}, Amount: ${item.amount}`);
            });
          } else {
            console.log('⚠️  No line items found in estimate details');
          }
        } else {
          console.error('Failed to fetch estimate details:', await estimateDetailsResponse.text());
        }
      }
    } else {
      console.error('Failed to fetch estimates:', await estimatesResponse.text());
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testLineItems();