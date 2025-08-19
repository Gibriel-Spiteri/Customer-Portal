import { NetSuiteM2M } from './server/services/netsuite-m2m.js';

async function testCustomerDiscountDetails() {
  const service = new NetSuiteM2M();
  
  try {
    // First, let's explore what fields are available for the Customer Discount item
    const itemQuery = `
      SELECT 
        item.id,
        item.itemid,
        item.displayname,
        item.description,
        item.itemtype,
        item.custitem_discount_category,
        item.custitem_discount_type,
        item.isinactive,
        item.includechildren,
        item.rate
      FROM 
        item
      WHERE 
        item.id = 3620
    `.trim();
    
    console.log('Fetching Customer Discount item details...');
    const itemResult = await service.executeSuiteQL(itemQuery);
    console.log('Customer Discount Item Details:', JSON.stringify(itemResult, null, 2));
    
    // Now let's get more details about how this discount is applied in the order
    const discountDetailsQuery = `
      SELECT 
        transactionline.id AS lineId,
        transactionline.linesequencenumber AS lineNumber,
        BUILTIN.DF(transactionline.item) AS itemName,
        transactionline.item AS itemId,
        transactionline.quantity,
        transactionline.rate,
        transactionline.amount,
        transactionline.memo AS description,
        transactionline.ratepercent,
        transactionline.taxrate1,
        transactionline.isclosed,
        transactionline.commitinventory,
        transactionline.options,
        transactionline.department,
        transactionline.class,
        transactionline.location,
        transactionline.subsidiary,
        transactionline.units,
        transactionline.uniquekey
      FROM 
        transactionline
      WHERE 
        transactionline.transaction = 6279369
        AND transactionline.item = 3620
    `.trim();
    
    console.log('\nFetching Customer Discount line details from order...');
    const lineResult = await service.executeSuiteQL(discountDetailsQuery);
    console.log('Customer Discount Line Details:', JSON.stringify(lineResult, null, 2));
    
    // Let's also check if there are any custom fields related to discounts
    const customFieldsQuery = `
      SELECT 
        transactionline.*
      FROM 
        transactionline
      WHERE 
        transactionline.transaction = 6279369
        AND transactionline.item = 3620
    `.trim();
    
    console.log('\nFetching all fields for Customer Discount line...');
    const allFieldsResult = await service.executeSuiteQL(customFieldsQuery);
    console.log('All Customer Discount Line Fields:', JSON.stringify(allFieldsResult, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testCustomerDiscountDetails();