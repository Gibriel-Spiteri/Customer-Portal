import fetch from 'node-fetch';

async function testConsumersCash() {
  try {
    console.log('\n====== Testing Consumers Cash for CRD Customer 154783 ======\n');
    
    // Login as CRD demo user
    const loginRes = await fetch('http://localhost:5000/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: '154783' })
    });
    
    if (!loginRes.ok) {
      console.error('Failed to login as CRD customer 154783');
      return;
    }
    
    const { token, user } = await loginRes.json();
    console.log('✅ Logged in as:', user.companyName);
    console.log('   Customer ID:', user.netsuiteCustomerId);
    
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    
    // Test fetching CRD rebates (Consumers Cash)
    console.log('\n💰 Fetching Consumers Cash data...');
    const rebatesRes = await fetch('http://localhost:5000/api/crd-rebates', { headers });
    
    if (rebatesRes.ok) {
      const data = await rebatesRes.json();
      console.log('✅ Consumers Cash data fetched successfully!');
      
      console.log('\n📊 Summary:');
      console.log('   Total Available:', `$${data.summary.totalAvailable}`);
      console.log('   Total Redeemed:', `$${data.summary.totalRedeemed}`);
      console.log('   Total Expired:', `$${data.summary.totalExpired}`);
      console.log('   Total Rebates:', data.summary.totalRebates);
      
      if (data.rebates && data.rebates.length > 0) {
        console.log('\n📝 Recent Rebates:');
        data.rebates.slice(0, 5).forEach((rebate, i) => {
          console.log(`   ${i+1}. Amount: $${rebate.amount || '0.00'}`);
          console.log(`      Date: ${rebate.date || 'N/A'}`);
          console.log(`      Status: ${rebate.status}`);
          if (rebate.expirationDate) {
            console.log(`      Expires: ${rebate.expirationDate}`);
          }
          if (rebate.salesOrder) {
            console.log(`      Sales Order: ${rebate.salesOrder}`);
          }
          console.log('');
        });
      } else {
        console.log('\n   No rebates found for this customer');
      }
    } else {
      const errorText = await rebatesRes.text();
      console.error('❌ Consumers Cash failed:', rebatesRes.status, errorText);
    }
    
    console.log('\n====== Consumers Cash Test Complete ======\n');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testConsumersCash();