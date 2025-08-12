# NetSuite M2M (Machine-to-Machine) Authentication Setup

## Overview
This guide explains how to set up and use NetSuite's OAuth 2.0 M2M authentication with SuiteQL queries to fetch data directly from NetSuite.

## Features
- OAuth 2.0 Client Credentials flow for server-to-server authentication
- SuiteQL query execution for flexible data retrieval
- Automatic token management and caching
- Support for fetching estimates, orders, and other transaction data

## Environment Variables Required

```bash
# NetSuite Account Configuration
NETSUITE_ACCOUNT_ID=1212804

# OAuth 2.0 Client Credentials
NETSUITE_CONSUMER_KEY=your_consumer_key_here
NETSUITE_CONSUMER_SECRET=your_consumer_secret_here

# Optional: For certificate-based authentication
NETSUITE_CERTIFICATE_ID=your_certificate_id
NETSUITE_PRIVATE_KEY=your_private_key_pem_format
```

## NetSuite Setup Steps

### 1. Enable OAuth 2.0 Feature
1. Go to **Setup → Company → Enable Features**
2. Under **SuiteCloud** tab, enable:
   - **OAuth 2.0**
   - **REST Web Services**
   - **SuiteQL**

### 2. Create Integration Record
1. Go to **Setup → Integration → Manage Integrations → New**
2. Set the following:
   - **Name**: Customer Portal M2M
   - **State**: Enabled
   - **OAuth 2.0 → Client Credentials (M2M) Setup**:
     - Check **Enabled**
     - **Scope**: REST_WEBSERVICES
   - **Note**: Save the Consumer Key and Consumer Secret

### 3. Assign Permissions to Integration
The integration needs appropriate permissions to execute SuiteQL queries:

1. Go to **Setup → Users/Roles → Access Tokens → New**
2. Select:
   - **Application Name**: Your integration name
   - **User**: A user with appropriate permissions
   - **Role**: A role with the following permissions:
     - **Transactions**: View
     - **Lists → Customers**: View
     - **SuiteQL**: Full

## SuiteQL Query Examples

### Fetch Estimates
```sql
SELECT 
  transaction.id,
  transaction.tranid AS documentNumber,
  transaction.trandate AS date,
  transaction.status,
  transaction.total,
  BUILTIN.DF(transaction.entity) AS customerName
FROM 
  transaction
WHERE 
  transaction.type = 'Estimate'
  AND transaction.mainline = 'T'
ORDER BY 
  transaction.trandate DESC
```

### Fetch Sales Orders
```sql
SELECT 
  transaction.id,
  transaction.tranid AS orderNumber,
  transaction.status,
  transaction.total,
  transaction.shipdate
FROM 
  transaction
WHERE 
  transaction.type = 'SalesOrd'
  AND transaction.entity = :customerId
ORDER BY 
  transaction.trandate DESC
```

## API Endpoints

### Test M2M Connection
```bash
GET /api/netsuite/m2m/test
Authorization: Bearer YOUR_JWT_TOKEN
```

### Fetch Estimates
```bash
GET /api/estimates?limit=20&offset=0
Authorization: Bearer YOUR_JWT_TOKEN
```

Response:
```json
{
  "items": [
    {
      "id": "12345",
      "documentNumber": "EST-001",
      "date": "2025-01-11",
      "expirationDate": "2025-02-11",
      "status": "Open",
      "total": "5000.00",
      "customerName": "ABC Company",
      "currency": "USD"
    }
  ],
  "hasMore": false,
  "totalResults": 1
}
```

### Get Estimate Details
```bash
GET /api/estimates/12345
Authorization: Bearer YOUR_JWT_TOKEN
```

## Implementation Details

### Service: `server/services/netsuite-m2m.ts`
- Handles OAuth 2.0 token generation and management
- Executes SuiteQL queries
- Provides methods for fetching specific data types

Key Methods:
- `getAccessToken()`: Obtains and caches OAuth token
- `executeSuiteQL()`: Runs SuiteQL queries
- `getCustomerEstimates()`: Fetches estimates for a customer
- `getAllEstimates()`: Fetches all estimates (admin)
- `getEstimateDetails()`: Gets detailed estimate with line items

### Integration with Dashboard
The dashboard now displays estimates fetched directly from NetSuite:
1. Queries the `/api/estimates` endpoint
2. Displays recent estimates with status badges
3. Shows estimate details including dates, amounts, and locations

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Verify Consumer Key and Secret are correct
   - Check integration is enabled in NetSuite
   - Ensure user has proper permissions

2. **Invalid Grant**
   - Token generation failed
   - Check JWT signing method (HMAC vs RSA)
   - Verify account ID format

3. **SuiteQL Errors**
   - Check query syntax
   - Verify table and field names
   - Ensure proper permissions for queried records

### Debug Mode
Enable debug logging:
```javascript
console.log('NetSuite M2M: Token request:', url);
console.log('NetSuite M2M: Query:', query);
```

## Security Considerations

1. **Token Storage**: Access tokens are cached in memory with expiration
2. **Customer Isolation**: Queries filter by customer ID when applicable
3. **Permission Validation**: Customer access is verified before returning data
4. **Secure Transport**: All API calls use HTTPS

## Testing

### Manual Testing
1. Set up environment variables
2. Test connection: `curl http://localhost:5000/api/netsuite/m2m/test`
3. Fetch estimates: `curl http://localhost:5000/api/estimates`

### Automated Testing
```javascript
const m2m = new NetSuiteM2M();
const result = await m2m.testConnection();
console.log('Connection test:', result);
```

## Next Steps

1. **Expand Data Types**: Add support for invoices, payments, etc.
2. **Caching Layer**: Implement Redis caching for frequently accessed data
3. **Webhook Integration**: Set up NetSuite webhooks for real-time updates
4. **Batch Operations**: Support bulk data fetching for reports

## References
- [NetSuite OAuth 2.0 Documentation](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_162045256793.html)
- [SuiteQL Documentation](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_156257770590.html)
- [REST Web Services](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/book_1559132836.html)