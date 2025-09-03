import { NetSuiteM2M } from './server/services/netsuite-m2m.js';

async function testCustomerGrowthDirect() {
  try {
    console.log('Testing NetSuite Customer Growth Analysis...\n');
    console.log('Initializing NetSuite M2M connection...');
    
    const m2m = new NetSuiteM2M();

    // SuiteQL query to get customer creation dates grouped by month
    const query = `
      SELECT 
        TO_CHAR(customer.datecreated, 'YYYY-MM') AS month,
        COUNT(customer.id) AS new_customers,
        MIN(customer.datecreated) AS earliest_date,
        MAX(customer.datecreated) AS latest_date
      FROM 
        customer
      WHERE 
        customer.datecreated IS NOT NULL
        AND customer.datecreated >= ADD_MONTHS(CURRENT_DATE, -24)
      GROUP BY 
        TO_CHAR(customer.datecreated, 'YYYY-MM')
      ORDER BY 
        TO_CHAR(customer.datecreated, 'YYYY-MM') DESC
    `.trim();

    console.log('Executing SuiteQL query...\n');
    const result = await m2m.executeSuiteQL(query, 100, 0);

    // Calculate growth metrics
    const monthlyData = result.items || [];
    
    // Calculate month-over-month growth
    const growthData = monthlyData.map((month, index) => {
      const previousMonth = monthlyData[index + 1];
      let growthRate = null;
      let growthAmount = null;
      
      if (previousMonth && previousMonth.new_customers > 0) {
        growthAmount = month.new_customers - previousMonth.new_customers;
        growthRate = ((month.new_customers - previousMonth.new_customers) / previousMonth.new_customers * 100).toFixed(2);
      }
      
      return {
        ...month,
        growth_rate: growthRate ? `${growthRate}%` : null,
        growth_amount: growthAmount
      };
    });

    // Calculate statistics
    const totalCustomers = monthlyData.reduce((sum, month) => sum + month.new_customers, 0);
    const avgPerMonth = monthlyData.length > 0 ? (totalCustomers / monthlyData.length).toFixed(1) : 0;
    const lastMonth = monthlyData[0]?.new_customers || 0;
    const lastThreeMonths = monthlyData.slice(0, 3).reduce((sum, month) => sum + month.new_customers, 0);
    const lastSixMonths = monthlyData.slice(0, 6).reduce((sum, month) => sum + month.new_customers, 0);
    const lastYear = monthlyData.slice(0, 12).reduce((sum, month) => sum + month.new_customers, 0);

    // Display results
    console.log('=== CUSTOMER GROWTH ANALYSIS ===\n');
    console.log('SUMMARY:');
    console.log('--------');
    console.log(`Period: Last 24 months`);
    console.log(`Total customers added: ${totalCustomers}`);
    console.log(`Average per month: ${avgPerMonth}`);
    console.log(`Last month: ${lastMonth} customers`);
    console.log(`Last 3 months: ${lastThreeMonths} customers`);
    console.log(`Last 6 months: ${lastSixMonths} customers`);
    console.log(`Last 12 months: ${lastYear} customers`);
    
    console.log('\n\nMONTHLY BREAKDOWN (Top 12 months):');
    console.log('------------------------------------');
    console.log('Month       | New Customers | Growth Rate | Growth Amount');
    console.log('----------- | ------------- | ----------- | -------------');
    
    growthData.slice(0, 12).forEach(month => {
      const monthStr = month.month.padEnd(11);
      const newCustomersStr = String(month.new_customers).padEnd(13);
      const growthRateStr = (month.growth_rate || 'N/A').padEnd(11);
      const growthAmountStr = month.growth_amount !== null ? String(month.growth_amount) : 'N/A';
      
      console.log(`${monthStr} | ${newCustomersStr} | ${growthRateStr} | ${growthAmountStr}`);
    });
    
    console.log('\nTotal data points:', monthlyData.length);
    console.log('Query executed successfully at:', new Date().toISOString());

  } catch (error) {
    console.error('\n❌ Error fetching customer growth data:');
    console.error('Message:', error.message);
    
    if (error.message.includes('configured')) {
      console.error('\n⚠️  NetSuite M2M authentication is not configured properly.');
      console.error('Please ensure the following environment variables are set:');
      console.error('- NETSUITE_ACCOUNT_ID');
      console.error('- NETSUITE_CONSUMER_KEY');
      console.error('- NETSUITE_CONSUMER_SECRET');
      console.error('- NETSUITE_CERTIFICATE_ID');
      console.error('- NETSUITE_PRIVATE_KEY (or netsuite_private_key.pem file)');
    }
  }
}

// Run the test
testCustomerGrowthDirect();