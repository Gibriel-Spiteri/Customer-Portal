import fetch from 'node-fetch';

async function testContactsAPI() {
  try {
    console.log('\n====== Testing Customer Contacts API ======\n');
    
    // Login as demo user
    const loginRes = await fetch('http://localhost:5000/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: '154783' })
    });
    
    if (!loginRes.ok) {
      console.error('Failed to login as demo customer');
      const errorText = await loginRes.text();
      console.error('Error:', errorText);
      return;
    }
    
    const { token } = await loginRes.json();
    console.log('✓ Logged in successfully, got token');
    
    // Fetch customer contacts
    console.log('\nFetching customer contacts...');
    const contactsRes = await fetch('http://localhost:5000/api/customer-contacts', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!contactsRes.ok) {
      console.error('Failed to fetch contacts');
      const errorText = await contactsRes.text();
      console.error('Error:', errorText);
      return;
    }
    
    const contacts = await contactsRes.json();
    console.log(`\nFound ${contacts.length} contact(s):`);
    console.log(JSON.stringify(contacts, null, 2));
    
    // Also fetch account info to verify customer ID
    console.log('\nFetching account info...');
    const accountRes = await fetch('http://localhost:5000/api/account', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (accountRes.ok) {
      const account = await accountRes.json();
      console.log('\nAccount info:');
      console.log(`Customer Number: ${account.customerNumber}`);
      console.log(`Company: ${account.companyName}`);
      console.log(`NetSuite ID: ${account.id}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testContactsAPI();