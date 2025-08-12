import fetch from 'node-fetch';

async function testCRDCustomer154783() {
  try {
    console.log('\n====== Testing CRD Customer 154783 ======\n');
    
    // Login as CRD demo user with new customer ID
    const loginRes = await fetch('http://localhost:5000/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: '154783' })
    });
    
    if (!loginRes.ok) {
      console.error('Failed to login as CRD customer 154783');
      const errorText = await loginRes.text();
      console.error('Error:', errorText);
      return;
    }
    
    const { token, user } = await loginRes.json();
    console.log('✅ Logged in as:', user.companyName);
    console.log('   Customer ID:', user.netsuiteCustomerId);
    console.log('   Email:', user.email);
    console.log('   Name:', user.firstName, user.lastName);
    
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    
    // Test fetching account info
    console.log('\n👤 Fetching Account Info...');
    const accountRes = await fetch('http://localhost:5000/api/account', { headers });
    if (accountRes.ok) {
      const account = await accountRes.json();
      console.log('✅ Account data fetched');
      console.log('   Customer Number:', account.customerNumber);
      console.log('   Balance:', account.balance);
      console.log('   Credit Limit:', account.creditLimit);
    } else {
      console.error('❌ Account failed:', await accountRes.text());
    }
    
    // Test dashboard data
    console.log('\n📊 Fetching Dashboard...');
    const dashboardRes = await fetch('http://localhost:5000/api/dashboard', { headers });
    if (dashboardRes.ok) {
      const dashboard = await dashboardRes.json();
      console.log('✅ Dashboard data fetched');
      console.log('   Account Balance:', dashboard.account?.balance || 'N/A');
      console.log('   Pending Orders:', dashboard.pendingOrdersCount || 0);
      console.log('   Total Orders:', dashboard.orders?.length || 0);
      console.log('   Total Invoices:', dashboard.invoices?.length || 0);
    } else {
      console.error('❌ Dashboard failed:', await dashboardRes.text());
    }
    
    // Test fetching orders
    console.log('\n📦 Fetching Orders...');
    const ordersRes = await fetch('http://localhost:5000/api/orders?limit=3', { headers });
    if (ordersRes.ok) {
      const orders = await ordersRes.json();
      console.log(`✅ Found ${orders.length} orders`);
      orders.forEach((order, i) => {
        console.log(`   Order ${i+1}: ${order.orderNumber || order.tranid || 'N/A'} - Status: ${order.status || 'N/A'} - Total: ${order.total || 'N/A'}`);
      });
    } else {
      console.error('❌ Orders failed:', await ordersRes.text());
    }
    
    console.log('\n====== CRD Customer 154783 Test Complete ======\n');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCRDCustomer154783();