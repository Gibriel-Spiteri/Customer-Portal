import fetch from 'node-fetch';

async function testCRDCustomer() {
  try {
    console.log('\n====== Testing CRD Customer 154129 ======\n');
    
    // Login as CRD demo user
    const loginRes = await fetch('http://localhost:5000/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: '154129' })
    });
    
    if (!loginRes.ok) {
      console.error('Failed to login as CRD customer');
      return;
    }
    
    const { token, user } = await loginRes.json();
    console.log('✅ Logged in as:', user.companyName);
    console.log('   Customer ID:', user.netsuiteCustomerId);
    console.log('   Email:', user.email);
    
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    
    // Test fetching estimates
    console.log('\n📋 Fetching Estimates...');
    const estimatesRes = await fetch('http://localhost:5000/api/estimates?limit=5', { headers });
    if (estimatesRes.ok) {
      const estimates = await estimatesRes.json();
      console.log(`✅ Found ${estimates.length} estimates`);
      if (estimates.length > 0) {
        console.log('   First estimate:', estimates[0].documentNumber, '- Total:', estimates[0].total);
      }
    } else {
      console.error('❌ Estimates failed:', await estimatesRes.text());
    }
    
    // Test fetching orders
    console.log('\n📦 Fetching Orders...');
    const ordersRes = await fetch('http://localhost:5000/api/orders?limit=5', { headers });
    if (ordersRes.ok) {
      const orders = await ordersRes.json();
      console.log(`✅ Found ${orders.length} orders`);
      if (orders.length > 0) {
        console.log('   First order:', orders[0].orderNumber, '- Status:', orders[0].status);
      }
    } else {
      console.error('❌ Orders failed:', await ordersRes.text());
    }
    
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
      console.log('   Monthly Total:', dashboard.monthlyTotal || '0.00');
    } else {
      console.error('❌ Dashboard failed:', await dashboardRes.text());
    }
    
    console.log('\n====== CRD Customer Test Complete ======\n');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCRDCustomer();