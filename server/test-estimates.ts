import { netsuiteService } from './services/netsuite';

async function testEstimatesFetch() {
  console.log('Testing estimates fetch for customer 1263...');
  
  try {
    const result = await netsuiteService.getCustomerEstimates('1263');
    console.log('NetSuite estimates response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error fetching estimates:', error);
  }
}

testEstimatesFetch();