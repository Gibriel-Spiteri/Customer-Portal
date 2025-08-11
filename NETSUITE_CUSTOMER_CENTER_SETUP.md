# NetSuite Customer Center SSO Setup Guide

## Overview
This guide explains how to set up NetSuite Customer Center integration to allow customers to authenticate through their existing NetSuite Customer Center accounts. This is separate from the employee SSO and provides a dedicated authentication flow for external customers.

## Prerequisites

1. **NetSuite Administrator Access** - You need admin access to configure Customer Center integration
2. **Customer Center enabled in NetSuite** - Customer Center feature must be activated
3. **Customer roles configured** - Customers must have appropriate roles and permissions
4. **Existing Employee SSO working** - Employee SSO should be working as the foundation

## Step 1: Create Customer Center Suitelet

Create a new SuiteScript 2.1 Suitelet specifically for Customer Center authentication:

### File: `customer_sso_suitelet.js`

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/runtime', 'N/https', 'N/crypto'], function(runtime, https, crypto) {
    
    function onRequest(context) {
        var request = context.request;
        var response = context.response;
        
        try {
            // Get current user information
            var currentUser = runtime.getCurrentUser();
            
            // Validate this is a customer user (not employee)
            if (!currentUser.roleId || currentUser.roleCenter !== 'CUSTOMERCENTER') {
                throw new Error('Invalid user type for Customer Center SSO');
            }
            
            // Get customer information
            var userInfo = {
                name: currentUser.name,
                email: currentUser.email,
                customerId: currentUser.entity || currentUser.id,
                entityId: currentUser.entity,
                companyName: getCustomerCompanyName(currentUser.entity),
                isCustomer: true,
                customerType: 'customer_center',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiration
            };
            
            // Generate JWT token with customer information
            var token = createCustomerJWT(userInfo);
            
            // Get callback URL from request parameters
            var callbackUrl = request.parameters.callback || 
                'YOUR_REPLIT_DOMAIN/api/auth/netsuite/customer/sso';
            
            // Redirect back to application with customer token
            var redirectUrl = callbackUrl + '?sso_token=' + encodeURIComponent(token);
            
            response.sendRedirect({
                type: https.RedirectType.EXTERNAL,
                url: redirectUrl
            });
            
        } catch (error) {
            log.error('Customer SSO Error', error.toString());
            
            // Redirect to error page
            var errorUrl = 'YOUR_REPLIT_DOMAIN/login?error=' + 
                encodeURIComponent('Customer authentication failed: ' + error.message);
            
            response.sendRedirect({
                type: https.RedirectType.EXTERNAL,
                url: errorUrl
            });
        }
    }
    
    function getCustomerCompanyName(entityId) {
        try {
            // Load customer record to get company name
            var customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: entityId
            });
            
            return customerRecord.getValue({
                fieldId: 'companyname'
            }) || customerRecord.getValue({
                fieldId: 'entityid'
            });
        } catch (e) {
            return null;
        }
    }
    
    function createCustomerJWT(payload) {
        // Use the same shared secret as employee SSO
        var secret = 'YOUR_SHARED_SECRET_HERE';
        
        // Create JWT header
        var header = {
            typ: 'JWT',
            alg: 'HS256'
        };
        
        // Encode header and payload
        var encodedHeader = encode.base64url(JSON.stringify(header));
        var encodedPayload = encode.base64url(JSON.stringify(payload));
        
        // Create signature
        var signature = crypto.createHmac({
            algorithm: crypto.HashAlg.SHA256,
            key: secret
        }).update(encodedHeader + '.' + encodedPayload).digest({
            outputEncoding: encode.Encoding.BASE_64_URL_SAFE
        });
        
        // Return complete JWT
        return encodedHeader + '.' + encodedPayload + '.' + signature;
    }
    
    return {
        onRequest: onRequest
    };
});
```

## Step 2: Deploy Customer Center Suitelet

1. **Upload the Script:**
   - Go to **Customization > Scripting > Scripts > New**
   - Upload the `customer_sso_suitelet.js` file
   - Set **Script Type** to "Suitelet"

2. **Configure Script:**
   - **Name**: Customer Center SSO Suitelet
   - **ID**: `customscript_customer_sso_suitelet`
   - **Function**: `onRequest`

3. **Create Script Deployment:**
   - **Title**: Customer Center SSO Deployment
   - **ID**: `customdeploy_customer_sso_deploy`
   - **Status**: Released
   - **Log Level**: Error
   - **Execute As Role**: Customer Center role
   - **Audience**: All Roles (or specific customer roles)

## Step 3: Configure Customer Center Permissions

### Customer Role Permissions
Ensure customer roles have these permissions:

1. **General Permissions:**
   - **Login using Access Tokens**: Full
   - **Customer Center**: Full
   - **Custom Records**: View (if needed)

2. **Customer Center Specific:**
   - **Customer Records**: View (Own records only)
   - **Transaction Records**: View (Own records only)  
   - **Support Cases**: View/Edit (Own records only)
   - **Payments**: View (Own records only)

### Customer Center Setup
1. **Enable Customer Center:**
   - Go to **Setup > Company > Enable Features**
   - Check **Customer Center** under CRM tab

2. **Configure Customer Center:**
   - Go to **Setup > Company > Customer Center**
   - Enable features needed by customers
   - Set appropriate permissions and restrictions

## Step 4: Environment Configuration

Add these environment variables to your Replit project:

```bash
# Customer Center SSO Configuration (reuses employee SSO secret)
NETSUITE_CUSTOMER_SSO_SCRIPT_ID=4390  # Different from employee script
NETSUITE_CUSTOMER_SSO_DEPLOY_ID=1
NETSUITE_SSO_SECRET=your_shared_secret_here  # Same as employee SSO
```

## Step 5: NetSuite URL Configuration

Update the Customer Center Suitelet with your actual Replit domain:

1. Replace `YOUR_REPLIT_DOMAIN` with your actual Replit domain
2. Replace `YOUR_SHARED_SECRET_HERE` with your actual shared secret

Example:
```javascript
var callbackUrl = request.parameters.callback || 
    'https://8ae361fb-6ae3-4428-bdcb-35ba3f53f886-00-v5e1qu1mb6wj.worf.replit.dev/api/auth/netsuite/customer/sso';
```

## Step 6: Testing Customer Center SSO

1. **Access Customer Center:**
   - Login to NetSuite as a customer
   - Navigate to Customer Center
   - You should see a "Sign in to Portal" option

2. **Test Authentication Flow:**
   - From your portal, click "Customer" login option
   - Should redirect to NetSuite Customer Center
   - Authenticate as a customer
   - Should redirect back to portal with customer data

## Security Considerations

1. **Token Security:**
   - Uses same shared secret as employee SSO
   - Tokens expire after 1 hour
   - Customer tokens include `isCustomer: true` flag

2. **Customer Isolation:**
   - Customers can only see their own data
   - Customer tokens are distinct from employee tokens
   - Role-based access controls enforced

3. **Audit Trail:**
   - All customer SSO attempts are logged
   - Failed authentications are tracked
   - User access is monitored

## Troubleshooting

### Common Issues:

1. **"Invalid user type" error:**
   - User is not logged into Customer Center
   - User role doesn't have Customer Center access

2. **"Authentication failed" error:**
   - Check shared secret configuration
   - Verify Suitelet deployment is active
   - Check customer role permissions

3. **Redirect loop:**
   - Verify callback URL is correct
   - Check Replit domain configuration
   - Ensure Customer Center is enabled

### Debug Steps:

1. **Check NetSuite Script Logs:**
   - Go to **Customization > Scripting > Script Deployments**
   - View execution logs for customer SSO script

2. **Verify Customer Permissions:**
   - Check customer role has required permissions
   - Ensure Customer Center access is enabled

3. **Test Token Generation:**
   - Use NetSuite's SuiteScript debugger
   - Verify JWT token structure and signature

## Customer vs Employee Differences

| Feature | Employee SSO | Customer SSO |
|---------|-------------|--------------|
| **Access Level** | Full NetSuite access | Customer Center only |
| **Data Scope** | All company data | Own records only |
| **Script ID** | 4389 | 4390 |
| **Token Flag** | `isCustomer: false` | `isCustomer: true` |
| **Role Type** | Employee roles | Customer Center roles |
| **Authentication** | NetSuite login | Customer Center login |

This setup provides secure, separate authentication flows for both employees and customers while maintaining data isolation and appropriate access controls.