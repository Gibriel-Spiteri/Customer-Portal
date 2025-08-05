console.log('NetSuite configuration check:');
console.log('NETSUITE_ACCOUNT_ID:', process.env.NETSUITE_ACCOUNT_ID);
console.log('NETSUITE_CONSUMER_KEY:', process.env.NETSUITE_CONSUMER_KEY ? 'Set' : 'Not set');
console.log('NETSUITE_CONSUMER_SECRET:', process.env.NETSUITE_CONSUMER_SECRET ? 'Set' : 'Not set');
console.log('NETSUITE_TOKEN_ID:', process.env.NETSUITE_TOKEN_ID ? 'Set' : 'Not set');
console.log('NETSUITE_TOKEN_SECRET:', process.env.NETSUITE_TOKEN_SECRET ? 'Set' : 'Not set');

const baseUrl = process.env.NETSUITE_BASE_URL || `https://${process.env.NETSUITE_ACCOUNT_ID}.suitetalk.api.netsuite.com`;
console.log('Constructed base URL:', baseUrl);