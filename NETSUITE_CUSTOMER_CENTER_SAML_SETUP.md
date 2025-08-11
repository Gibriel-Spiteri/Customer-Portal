# NetSuite Customer Center SAML SSO Setup Guide

## Overview
This guide follows the official NetSuite documentation for enabling SAML Single Sign-On (SSO) access to Customer Center. The implementation ensures proper customer center role permissions and SAML authentication for secure customer portal access.

## Official NetSuite Documentation Reference
Based on: [NetSuite SAML SSO Access for Center Roles](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/bridgehead_N3827410.html)

## Prerequisites
1. NetSuite Administrator access
2. Customer Center feature enabled in NetSuite
3. SAML Single Sign-on feature enabled
4. Identity Provider (IdP) configured

## Step 1: Enable SAML Single Sign-on Feature
1. Go to **Setup > Company > Enable Features**
2. Navigate to **SuiteCloud** tab
3. Under **Manage Authentication** section:
   - ✅ Enable **SAML Single Sign-on**
4. Save the configuration

## Step 2: Configure Customer Center Role Permissions

### 2.1 Add SAML Permission to Customer Center Role
Following NetSuite's official guidance:

1. Go to **Setup > Users/Roles > User Management > Manage Roles**
2. Click **Edit** for a customized customer center role or **Customize** for a standard customer center role
3. On the Role page, click the **Permissions** subtab
4. On the **Setup** subtab, set the **Level** to **Full** for:
   - **SAML Single Sign-on** permission

### 2.2 Required Customer Center Role Permissions
Ensure the customer role has these essential permissions:

**Setup Permissions:**
- **SAML Single Sign-on**: Full
- **REST Web Services**: Full
- **Log in using Access Tokens**: Full

**Records Permissions:**
- **Customer Records**: View (own records only)
- **Transaction Records**: View (own records only)
- **Support Cases**: View/Edit (own records only)
- **Customer Center Access**: Full

**Additional Recommended Permissions:**
- **Customer Payments**: View (own records only)
- **Estimates**: View (own records only)
- **Sales Orders**: View (own records only)
- **Invoices**: View (own records only)

## Step 3: SAML Identity Provider Configuration

### 3.1 NetSuite as Service Provider (SP)
1. Go to **Setup > Integration > SAML Single Sign-on**
2. Click **New**
3. Configure basic settings:
   - **Name**: Customer Center SAML SSO
   - **State**: Enabled
   - **Audience URL**: Your NetSuite account URL
   - **Issuer**: Your IdP issuer URL

### 3.2 Configure SAML Attributes
Map the following SAML attributes for customer identification:

**Required Attributes:**
- **Email**: Maps to customer email field
- **Customer ID**: Maps to NetSuite customer internal ID
- **Name**: Maps to customer name

**Optional Attributes:**
- **Company**: Maps to company name
- **Phone**: Maps to customer phone
- **Address**: Maps to billing address

## Step 4: Update Customer SSO Implementation

### 4.1 Enhanced SSO Token Processing
The SSO service should process customer-specific attributes:

```typescript
interface CustomerSSOTokenPayload extends SSOTokenPayload {
  customerId: string;
  customerInternalId?: string;
  companyName?: string;
  billingAddress?: string;
  phone?: string;
  customerCenterAccess?: boolean;
}
```

### 4.2 Customer Center Access Validation
Implement validation to ensure customer has proper center access:

1. Verify customer role has Customer Center permissions
2. Check SAML SSO permission is enabled
3. Validate customer record exists and is active
4. Confirm customer has appropriate transaction access

## Step 5: Suitelet Enhancement for Customer Center

### 5.1 Updated Suitelet Script
The NetSuite Suitelet should include customer center specific validation:

```javascript
/**
 * Enhanced Suitelet for Customer Center SAML SSO
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/runtime', 'N/https', 'N/crypto', 'N/record'], 
    function(runtime, https, crypto, record) {
    
    function onRequest(context) {
        var response = context.response;
        var currentUser = runtime.getCurrentUser();
        
        try {
            // Validate customer center access
            var customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: currentUser.id
            });
            
            // Check if customer is active and has center access
            var isActive = customerRecord.getValue('is_active');
            var hasWebAccess = customerRecord.getValue('giveaccess');
            
            if (!isActive || !hasWebAccess) {
                throw new Error('Customer does not have active center access');
            }
            
            var payload = {
                name: currentUser.name,
                email: currentUser.email,
                customerId: currentUser.id.toString(),
                entityId: currentUser.entity ? currentUser.entity.toString() : null,
                companyName: customerRecord.getValue('companyname'),
                customerCenterAccess: true,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600
            };
            
            var token = createJWT(payload);
            var callbackUrl = context.request.parameters.callback || 
                              'https://your-domain.replit.app/api/auth/netsuite/sso';
            
            response.sendRedirect({
                type: https.RedirectType.EXTERNAL,
                url: callbackUrl + '?sso_token=' + encodeURIComponent(token)
            });
            
        } catch (error) {
            log.error('Customer Center SSO Error', error.toString());
            response.write('Customer Center access denied: ' + error.message);
        }
    }
    
    // JWT creation function remains the same as before
    function createJWT(payload) { /* ... */ }
    
    return {
        onRequest: onRequest
    };
});
```

### 5.2 Deployment Settings for Customer Access
Update the Suitelet deployment:

1. **Audience**: Customer Center Users
2. **Execute As Role**: Customer Center Role (not Administrator)
3. **Available Without Login**: No
4. **Show in Bundles**: Optional

## Step 6: Frontend Customer Authentication Flow

### 6.1 Customer-Specific Login Page
Create customer-focused authentication:

1. **Customer-specific branding**: Company logo, colors
2. **Clear messaging**: "Sign in with your NetSuite Customer Center credentials"
3. **Error handling**: Customer-friendly error messages
4. **Account type detection**: Differentiate between customer and employee access

### 6.2 Post-Authentication Experience
After successful authentication:

1. **Welcome message**: Personalized greeting with company name
2. **Dashboard customization**: Show relevant customer data only
3. **Navigation**: Customer-appropriate menu items
4. **Data filtering**: Automatic filtering to customer's own records

## Step 7: Security and Access Control

### 7.1 Customer Data Isolation
Ensure strict data isolation:

```typescript
// Example middleware for customer data access
const validateCustomerAccess = async (req: any, res: any, next: any) => {
  const user = req.user;
  
  if (!user.isNetSuiteUser || !user.netsuiteCustomerId) {
    return res.status(403).json({ message: 'Customer access required' });
  }
  
  // Add customer ID filter to all queries
  req.customerFilter = {
    customerId: user.netsuiteCustomerId
  };
  
  next();
};
```

### 7.2 Customer Center Permissions Validation
Implement role-based access control:

1. **Transaction access**: Only customer's own orders, invoices, payments
2. **Support cases**: Only cases created by the customer
3. **Account information**: Only the customer's account details
4. **Company data**: Only data associated with the customer's company

## Step 8: Testing Customer Center SAML SSO

### 8.1 Test Scenarios
1. **Valid customer login**: Active customer with proper permissions
2. **Inactive customer**: Customer without active status
3. **No center access**: Customer without web access enabled
4. **Invalid permissions**: Customer without SAML SSO permission
5. **Token expiration**: Expired JWT token handling

### 8.2 Validation Checklist
- [ ] Customer can authenticate via SAML
- [ ] Customer sees only their own data
- [ ] Customer cannot access admin functions
- [ ] Customer can view/edit support cases
- [ ] Customer can view transaction history
- [ ] Customer cannot access other customers' data
- [ ] Session expires appropriately
- [ ] Error messages are customer-friendly

## Important Notes from NetSuite Documentation

1. **Automatic SAML Access**: "No special permission is required to grant a customer center role SAML access to a website. The SAML permission is enabled for all customer center users, after the SAML setup for the website is completed."

2. **Center Role Limitations**: "Center roles are different from other NetSuite roles in that you can only add a limited set of permissions to them."

3. **Web Store Access**: Customer center roles automatically have SAML access to web stores once SAML is configured.

## Troubleshooting

### Common Customer Center Issues
1. **"Access Denied" Error**: Check customer role has SAML SSO permission
2. **"Customer Not Found"**: Verify customer record exists and is active
3. **"Web Access Disabled"**: Enable web access for customer record
4. **"Invalid Customer Role"**: Ensure role is customer center type, not employee

### Debug Steps
1. Check NetSuite customer record status
2. Verify customer role permissions
3. Test SAML configuration
4. Review Suitelet execution logs
5. Validate JWT token contents

## Production Deployment

### Final Checklist
- [ ] SAML SSO feature enabled in NetSuite
- [ ] Customer center roles have SAML permission
- [ ] Customer records have web access enabled
- [ ] Suitelet deployed with customer center audience
- [ ] SSL certificates configured for production domain
- [ ] Customer data access properly isolated
- [ ] Error handling provides customer-appropriate messages
- [ ] Session management configured for customer use

This implementation ensures compliance with NetSuite's official SAML SSO requirements for customer center access while maintaining security and proper data isolation.