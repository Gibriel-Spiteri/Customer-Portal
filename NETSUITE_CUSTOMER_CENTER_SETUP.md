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
 * @NScriptType SuiteLet
 */

define(['N/redirect', 'N/encode', 'N/crypto', 'N/runtime', 'N/record'], function (redirect, encode, crypto, runtime, record) {
    const JWT_EXPIRATION_TIME = 3600; // JWT expiration time in seconds (1 hour)
    const AUDIENCE = 'replit.dev';
    const ISSUER = 'https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=4390&deploy=1'; // Customer script
    const d = 'custsecret_portal_sso'; // Same secret ID from secrets management page

    function onRequest(context) {
        const REDIRECT_URL = context.request.parameters.callback + '?sso_token=' || 
            `YOUR_REPLIT_DOMAIN/api/auth/netsuite/customer/sso?sso_token=`;
        
        try {
            const user = runtime.getCurrentUser();
            log.debug('customer user', `${user.id} ${user.name} ${user.email} ${user.role} ${user.roleId}`);

            // Validate this is a customer user (basic validation)
            if (!user.entity) {
                throw new Error('User must have an associated entity (customer) record');
            }

            // Get customer information
            const customerInfo = getCustomerInfo(user);
            log.debug('customerInfo', JSON.stringify(customerInfo));

            const payload = createCustomerPayload(user, customerInfo);
            log.debug({ title: 'customer payload', details: JSON.stringify(payload) });

            const jwtToken = generateJwtToken(payload);
            const redirectUrl = `${REDIRECT_URL}${jwtToken}`;
            log.debug('customer redirectUrl', redirectUrl);
            redirect.redirect({ url: redirectUrl });
            
        } catch (error) {
            log.error('Customer SSO Error', error);
            log.error(error.message, error.stack ? error.stack.toString() : '');
            
            // Redirect to error page
            const errorUrl = `YOUR_REPLIT_DOMAIN/login?error=${encodeURIComponent('Customer authentication failed: ' + error.message)}`;
            redirect.redirect({ url: errorUrl });
        }
    }

    function getCustomerInfo(user) {
        try {
            if (!user.entity) {
                return { companyName: null, customerType: 'unknown' };
            }

            // Load customer record to get company name and details
            const customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: user.entity
            });
            
            const companyName = customerRecord.getValue({ fieldId: 'companyname' }) || 
                               customerRecord.getValue({ fieldId: 'entityid' }) ||
                               customerRecord.getValue({ fieldId: 'altname' });
                               
            const customerType = customerRecord.getValue({ fieldId: 'category' }) || 'customer_center';
            
            log.debug('customer record loaded', `Company: ${companyName}, Type: ${customerType}`);
            
            return {
                companyName: companyName,
                customerType: customerType
            };
        } catch (e) {
            log.error('Error loading customer record', e.toString());
            return { 
                companyName: user.name || 'Unknown Customer', 
                customerType: 'customer_center' 
            };
        }
    }

    function createCustomerPayload(user, customerInfo) {
        const currentTime = Math.round(Date.now() / 1000);
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            customerId: user.entity,
            entityId: user.entity,
            companyName: customerInfo.companyName,
            isCustomer: true,
            customerType: customerInfo.customerType,
            aud: AUDIENCE,
            iss: ISSUER,
            exp: currentTime + JWT_EXPIRATION_TIME,
            iat: currentTime
        };
    }

    function toBase64UrlSafe(str) {
        return encode
            .convert({
                string: str,
                inputEncoding: encode.Encoding.UTF_8,
                outputEncoding: encode.Encoding.BASE_64_URL_SAFE
            })
            .replace(/=+$/, '');
    }

    function generateJwtToken(payload) {
        const header = toBase64UrlSafe(
            JSON.stringify({
                type: 'JWT',
                alg: 'HS256'
            })
        );

        const body = toBase64UrlSafe(JSON.stringify(payload));

        const secretKey = crypto.createSecretKey({
            secret: d,
            encoding: encode.Encoding.UTF_8
        });

        const signer = crypto.createHmac({
            algorithm: crypto.HashAlg.SHA256,
            key: secretKey
        });

        signer.update({
            input: `${header}.${body}`,
            inputEncoding: encode.Encoding.UTF_8
        });

        const signature = signer
            .digest({
                outputEncoding: encode.Encoding.BASE_64_URL_SAFE
            })
            .replace(/=+$/, '');
            
        log.audit('customer signature', signature);
        log.audit('customer jwt', `${header}.${body}.${signature}`);
        return `${header}.${body}.${signature}`;
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
   - **API Version**: 2.1
   - **Script Type**: SuiteLet

3. **Create Script Deployment:**
   - **Title**: Customer Center SSO Deployment  
   - **ID**: `customdeploy_customer_sso_deploy`
   - **Status**: Released
   - **Log Level**: Debug (for testing, change to Error for production)
   - **Execute As Role**: Administrator (or specific customer role)
   - **Audience**: All Roles (ensure customer roles are included)
   - **URL**: Will be `https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=4390&deploy=1`

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
# Customer Center SSO Configuration
NETSUITE_CUSTOMER_SSO_SCRIPT_ID=4390  # Different from employee script (4389)
NETSUITE_CUSTOMER_SSO_DEPLOY_ID=1
NETSUITE_SSO_SECRET=your_shared_secret_here  # Same secret as employee SSO

# Ensure these existing variables are set
NETSUITE_ACCOUNT_ID=1212804
NETSUITE_SSO_SCRIPT_ID=4389  # Employee script
NETSUITE_SSO_DEPLOY_ID=1
```

**Important**: The customer suitelet uses the same `custsecret_portal_sso` secret from NetSuite's Secrets Management as the employee SSO, ensuring consistent token signing.

## Step 5: NetSuite URL Configuration

Update the Customer Center Suitelet with your actual Replit domain:

1. Replace `YOUR_REPLIT_DOMAIN` with your actual Replit domain in **two places**:
   - In the `REDIRECT_URL` fallback
   - In the error redirect URL

Example replacements:
```javascript
const REDIRECT_URL = context.request.parameters.callback + '?sso_token=' || 
    `https://8ae361fb-6ae3-4428-bdcb-35ba3f53f886-00-v5e1qu1mb6wj.worf.replit.dev/api/auth/netsuite/customer/sso?sso_token=`;
    
// And in error handling:
const errorUrl = `https://8ae361fb-6ae3-4428-bdcb-35ba3f53f886-00-v5e1qu1mb6wj.worf.replit.dev/login?error=${encodeURIComponent('Customer authentication failed: ' + error.message)}`;
```

**Note**: The script automatically uses the `custsecret_portal_sso` secret from NetSuite's Secrets Management, so no hardcoding of secrets is needed.

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