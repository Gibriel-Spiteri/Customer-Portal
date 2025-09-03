import fetch from 'node-fetch';

async function testCustomerGrowth() {
  try {
    // First, login to get a token
    console.log('Logging in...');
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'test@example.com',  // You may need to use a valid test account
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      console.log('Login failed:', await loginResponse.text());
      console.log('\nTrying without authentication (if endpoint allows)...\n');
    }

    const loginData = loginResponse.ok ? await loginResponse.json() : {};
    const token = loginData.token;

    // Now call the customer growth endpoint
    console.log('Fetching customer growth data...\n');
    const growthResponse = await fetch('http://localhost:5000/api/analytics/customer-growth', {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : undefined,
        'Content-Type': 'application/json'
      }
    });

    if (!growthResponse.ok) {
      console.error('Error response:', growthResponse.status, growthResponse.statusText);
      const errorText = await growthResponse.text();
      console.error('Error details:', errorText);
      return;
    }

    const growthData = await growthResponse.json();
    
    // Display the results
    console.log('=== CUSTOMER GROWTH ANALYSIS ===\n');
    
    if (growthData.success) {
      console.log('SUMMARY:');
      console.log('--------');
      console.log(`Period: ${growthData.summary.period}`);
      console.log(`Total customers added: ${growthData.summary.total_in_period}`);
      console.log(`Average per month: ${growthData.summary.average_per_month}`);
      console.log(`Last month: ${growthData.summary.last_month}`);
      console.log(`Last 3 months: ${growthData.summary.last_3_months}`);
      console.log(`Last 6 months: ${growthData.summary.last_6_months}`);
      console.log(`Last 12 months: ${growthData.summary.last_12_months}`);
      
      console.log('\n\nMONTHLY BREAKDOWN:');
      console.log('------------------');
      console.log('Month       | New Customers | Growth Rate | Growth Amount');
      console.log('----------- | ------------- | ----------- | -------------');
      
      growthData.monthly_breakdown.forEach(month => {
        const monthStr = month.month.padEnd(11);
        const newCustomersStr = String(month.new_customers).padEnd(13);
        const growthRateStr = (month.growth_rate || 'N/A').padEnd(11);
        const growthAmountStr = month.growth_amount !== null ? String(month.growth_amount) : 'N/A';
        
        console.log(`${monthStr} | ${newCustomersStr} | ${growthRateStr} | ${growthAmountStr}`);
      });
      
      console.log('\nQuery executed at:', growthData.query_info.executed_at);
    } else {
      console.log('Failed to fetch customer growth data');
      console.log('Response:', JSON.stringify(growthData, null, 2));
    }

  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testCustomerGrowth();