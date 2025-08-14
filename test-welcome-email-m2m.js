import { NetSuiteM2M } from './server/services/netsuite-m2m.js';

async function sendWelcomeEmail(email, customerId = null) {
  try {
    console.log(`\n=== Sending Welcome Email to ${email} ===`);
    
    // Use M2M authentication
    const m2m = new NetSuiteM2M();
    const token = await m2m.generateAccessToken();
    console.log('✓ M2M OAuth token obtained');
    
    // NetSuite RESTlet URL
    const NETSUITE_RESTLET_URL = 'https://1212804.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=4393&deploy=1';
    
    // Prepare the welcome email request
    const emailRequest = {
      type: 'welcome',
      email: email,
      customerId: customerId || 'GUEST', // Use GUEST if no customer ID provided
      loginUrl: 'https://customerportal.com/login'
    };
    
    console.log('Request payload:', JSON.stringify(emailRequest, null, 2));
    
    // Send the request to NetSuite RESTlet
    const response = await fetch(NETSUITE_RESTLET_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(emailRequest)
    });
    
    const responseText = await response.text();
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`RESTlet request failed: ${response.status} - ${responseText}`);
    }
    
    const result = JSON.parse(responseText);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✓ Welcome email sent successfully using NetSuite template 432!');
    } else {
      console.log('✗ Failed to send email:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
}

// Main execution
async function main() {
  console.log('NetSuite Welcome Email Test (M2M Authentication)');
  console.log('================================================');
  
  // Check for required environment variables
  if (!process.env.NETSUITE_ACCOUNT_ID || !process.env.NETSUITE_CONSUMER_KEY || !process.env.NETSUITE_CONSUMER_SECRET) {
    console.error('Error: Missing required M2M environment variables');
    console.error('Please ensure the following are set:');
    console.error('- NETSUITE_ACCOUNT_ID');
    console.error('- NETSUITE_CONSUMER_KEY');
    console.error('- NETSUITE_CONSUMER_SECRET');
    console.error('- NETSUITE_CERTIFICATE_ID');
    process.exit(1);
  }
  
  // Send welcome email to the specified address
  const result = await sendWelcomeEmail('gspiteri@consumersmail.com');
  
  if (result.success) {
    console.log('\n✅ Welcome email successfully sent to gspiteri@consumersmail.com');
    console.log('The email was sent using NetSuite template 432 with merge fields.');
  } else {
    console.log('\n❌ Failed to send welcome email');
    console.log('Error:', result.error);
  }
}

// Run the test
main().catch(console.error);