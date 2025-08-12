import fetch from 'node-fetch';

async function checkCustomer441667() {
  try {
    console.log('\nChecking estimates for customer ID: 441667');
    console.log('=' .repeat(60));
    
    // First, login to get a token
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'password123'
      })
    });
    
    if (!loginRes.ok) {
      console.error('Failed to login');
      return;
    }
    
    const { token } = await loginRes.json();
    
    // Update user to have customer ID 441667
    const updateRes = await fetch('http://localhost:5000/api/debug/set-customer/441667', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Now fetch estimates for this customer
    const estimatesRes = await fetch('http://localhost:5000/api/estimates', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (estimatesRes.ok) {
      const estimates = await estimatesRes.json();
      
      if (estimates.length === 0) {
        console.log('\n❌ No estimates found for customer ID 441667');
      } else {
        console.log(`\n✅ Found ${estimates.length} estimate(s) for customer ID 441667:\n`);
        
        estimates.forEach((estimate, index) => {
          console.log(`Estimate ${index + 1}:`);
          console.log(`  Document Number: ${estimate.estimateNumber}`);
          console.log(`  Customer: ${estimate.customerName || 'N/A'}`);
          console.log(`  Date: ${estimate.estimateDate}`);
          console.log(`  Status: ${estimate.status}`);
          console.log(`  Description: ${estimate.description || 'N/A'}`);
          console.log(`  Amount: ${estimate.amount}`);
          console.log('');
        });
      }
    } else {
      console.error('Failed to fetch estimates:', await estimatesRes.text());
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCustomer441667();