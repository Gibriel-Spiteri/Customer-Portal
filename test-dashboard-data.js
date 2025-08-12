import fetch from 'node-fetch';

async function testDashboardData() {
  try {
    console.log('\n====== Testing Dashboard Data for Customer 441667 ======\n');
    
    // First, login as demo user
    const loginRes = await fetch('http://localhost:5000/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!loginRes.ok) {
      console.error('Failed to login');
      return;
    }
    
    const { token } = await loginRes.json();
    console.log('✅ Logged in as demo user (Customer 441667)\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    
    // Test each endpoint
    console.log('1. TESTING DASHBOARD ENDPOINT');
    console.log('----------------------------------------');
    const dashboardRes = await fetch('http://localhost:5000/api/dashboard', { headers });
    if (dashboardRes.ok) {
      const dashboard = await dashboardRes.json();
      console.log('✅ Dashboard data fetched');
      console.log('  Account Balance:', dashboard.account?.balance || 'N/A');
      console.log('  Credit Limit:', dashboard.account?.creditLimit || 'N/A');
      console.log('  Pending Orders:', dashboard.pendingOrdersCount || 0);
      console.log('  Monthly Total:', dashboard.monthlyTotal || '0.00');
      console.log('  Recent Orders:', dashboard.recentOrders?.length || 0);
      console.log('  Recent Payments:', dashboard.recentPayments?.length || 0);
      console.log('  Outstanding Invoices:', dashboard.outstandingInvoices?.length || 0);
    } else {
      console.error('❌ Dashboard failed:', await dashboardRes.text());
    }
    
    console.log('\n2. TESTING ORDERS ENDPOINT');
    console.log('----------------------------------------');
    const ordersRes = await fetch('http://localhost:5000/api/orders?limit=5', { headers });
    if (ordersRes.ok) {
      const orders = await ordersRes.json();
      console.log(`✅ Found ${orders.length} orders`);
      if (orders.length > 0) {
        console.log('  First order:', orders[0].orderNumber, '- Status:', orders[0].status);
      }
    } else {
      console.error('❌ Orders failed:', await ordersRes.text());
    }
    
    console.log('\n3. TESTING INVOICES ENDPOINT');
    console.log('----------------------------------------');
    const invoicesRes = await fetch('http://localhost:5000/api/invoices?limit=5', { headers });
    if (invoicesRes.ok) {
      const invoices = await invoicesRes.json();
      console.log(`✅ Found ${invoices.length} invoices`);
      if (invoices.length > 0) {
        console.log('  First invoice:', invoices[0].invoiceNumber, '- Balance Due:', invoices[0].balanceDue);
      }
    } else {
      console.error('❌ Invoices failed:', await invoicesRes.text());
    }
    
    console.log('\n4. TESTING PAYMENTS ENDPOINT');
    console.log('----------------------------------------');
    const paymentsRes = await fetch('http://localhost:5000/api/payments?limit=5', { headers });
    if (paymentsRes.ok) {
      const payments = await paymentsRes.json();
      console.log(`✅ Found ${payments.length} payments`);
      if (payments.length > 0) {
        console.log('  First payment:', payments[0].paymentNumber, '- Amount:', payments[0].amount);
      }
    } else {
      console.error('❌ Payments failed:', await paymentsRes.text());
    }
    
    console.log('\n5. TESTING ACCOUNT ENDPOINT');
    console.log('----------------------------------------');
    const accountRes = await fetch('http://localhost:5000/api/account', { headers });
    if (accountRes.ok) {
      const account = await accountRes.json();
      console.log('✅ Account data fetched');
      console.log('  Customer Number:', account.customerNumber);
      console.log('  Company:', account.companyName);
      console.log('  Balance:', account.balance);
      console.log('  Credit Limit:', account.creditLimit);
      console.log('  Days Overdue:', account.daysOverdue);
    } else {
      console.error('❌ Account failed:', await accountRes.text());
    }
    
    console.log('\n====== All Tests Complete ======\n');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDashboardData();