import fetch from 'node-fetch';

async function testEstimatesAPI() {
  try {
    // First, register/login a test user
    const loginRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      })
    });
    
    let token;
    if (loginRes.ok) {
      const loginData = await loginRes.json();
      token = loginData.token;
    } else {
      // Try login if already exists
      const loginRetry = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123'
        })
      });
      
      if (loginRetry.ok) {
        const loginData = await loginRetry.json();
        token = loginData.token;
      } else {
        console.error('Failed to login:', await loginRetry.text());
        return;
      }
    }
    
    console.log('Successfully authenticated, token:', token ? 'obtained' : 'missing');
    
    // Now test the estimates endpoint
    const estimatesRes = await fetch('http://localhost:5000/api/estimates?limit=5', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (estimatesRes.ok) {
      const estimates = await estimatesRes.json();
      console.log('\n✅ Estimates API Response:');
      console.log('Number of estimates:', estimates.length);
      
      if (estimates.length > 0) {
        console.log('\nFirst estimate:');
        console.log(JSON.stringify(estimates[0], null, 2));
      }
    } else {
      console.error('Failed to fetch estimates:', await estimatesRes.text());
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testEstimatesAPI();