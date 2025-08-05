import { netsuiteService } from './services/netsuite';

async function testCustomerSearch() {
  const email = 'lewalsh@optonline.net';
  console.log(`Searching for customer with email: ${email}`);
  
  try {
    const searchResult = await netsuiteService.searchCustomerByEmail(email);
    console.log('Customer search response:', JSON.stringify(searchResult, null, 2));
    
    if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
      const customer = searchResult.data[0];
      console.log(`\nFound customer - ID: ${customer.id}, Name: ${customer.firstname} ${customer.lastname}`);
      
      // Now fetch estimates for this customer
      console.log(`\nFetching estimates for customer ID: ${customer.id}`);
      const estimatesResult = await netsuiteService.getCustomerEstimates(customer.id);
      console.log('Estimates response:', JSON.stringify(estimatesResult, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testCustomerSearch();