import fetch from 'node-fetch';

// NetSuite RESTlet configuration
const NETSUITE_RESTLET_URL = 'https://1212804.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=4393&deploy=1';

// OAuth 2.0 configuration
const oauth2Config = {
  clientId: process.env.NETSUITE_OIDC_CLIENT_ID,
  clientSecret: process.env.NETSUITE_OIDC_CLIENT_SECRET,
  tokenUrl: 'https://1212804.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token',
  scope: 'restlets rest_webservices'
};

async function getAccessToken() {
  try {
    const response = await fetch(oauth2Config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: oauth2Config.clientId,
        client_secret: oauth2Config.clientSecret,
        scope: oauth2Config.scope
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

async function sendWelcomeEmail(email, customerId = null) {
  try {
    console.log(`\n=== Sending Welcome Email to ${email} ===`);
    
    // Get OAuth access token
    const accessToken = await getAccessToken();
    console.log('✓ OAuth token obtained');
    
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
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(emailRequest)
    });
    
    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
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
  console.log('NetSuite Welcome Email Test');
  console.log('============================');
  
  // Check for required environment variables
  if (!process.env.NETSUITE_OIDC_CLIENT_ID || !process.env.NETSUITE_OIDC_CLIENT_SECRET) {
    console.error('Error: Missing required environment variables');
    console.error('Please ensure NETSUITE_OIDC_CLIENT_ID and NETSUITE_OIDC_CLIENT_SECRET are set');
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