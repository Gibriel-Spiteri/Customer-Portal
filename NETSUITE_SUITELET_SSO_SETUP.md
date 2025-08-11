# NetSuite Suitelet-based SSO Setup Guide

## Overview
This application now uses a NetSuite Suitelet to generate JWT tokens for Single Sign-On (SSO) authentication. This is the same approach used in your previous PHP project and is more reliable than OAuth 2.0.

## How It Works
1. User clicks "Sign in with NetSuite SSO" 
2. Application redirects to NetSuite Suitelet
3. User authenticates with NetSuite
4. Suitelet generates a JWT token with user information
5. Suitelet redirects back to our application with the JWT token
6. Application verifies the JWT and creates/updates the user session

## Prerequisites
1. NetSuite account with script deployment permissions
2. Access to create SuiteScripts
3. Shared secret key for JWT signing/verification

## Step 1: Create the Suitelet Script

### 1.1 Create the SuiteScript File
Create a new SuiteScript file in NetSuite:

**File: sso_suitelet.js**
```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/runtime', 'N/https'], function(runtime, https) {
    
    function onRequest(context) {
        var request = context.request;
        var response = context.response;
        
        try {
            // Get current user information
            var currentUser = runtime.getCurrentUser();
            var userInfo = {
                name: currentUser.name,
                email: currentUser.email,
                customerId: currentUser.id,
                entityId: currentUser.entity,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiration
            };
            
            // TODO: Replace with actual JWT generation using shared secret
            // For now, we'll create a simple base64 encoded token
            // In production, you should use proper JWT signing with HS256
            var token = createJWT(userInfo);
            
            // Redirect back to application with token
            var redirectUrl = 'http://localhost:5000/api/auth/netsuite/sso?sso_token=' + encodeURIComponent(token);
            response.sendRedirect({
                type: https.RedirectType.EXTERNAL,
                url: redirectUrl
            });
            
        } catch (error) {
            log.error('SSO Error', error.toString());
            response.write('Authentication failed: ' + error.message);
        }
    }
    
    function createJWT(payload) {
        // This is a simplified JWT creation for demonstration
        // In production, use proper JWT library with HMAC-SHA256 signing
        var header = {
            "alg": "HS256",
            "typ": "JWT"
        };
        
        var encodedHeader = base64urlEncode(JSON.stringify(header));
        var encodedPayload = base64urlEncode(JSON.stringify(payload));
        
        // TODO: Replace with actual HMAC-SHA256 signature using shared secret
        var signature = 'REPLACE_WITH_ACTUAL_SIGNATURE';
        
        return encodedHeader + '.' + encodedPayload + '.' + signature;
    }
    
    function base64urlEncode(str) {
        return btoa(str)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }
    
    return {
        onRequest: onRequest
    };
});
```

### 1.2 Upload and Deploy Script
1. Go to **Customization → Scripting → Scripts → New**
2. Upload the script file
3. Set **Name**: "SSO Suitelet"
4. Set **ID**: "customscript_sso_suitelet"
5. Create a deployment:
   - **Title**: "SSO Authentication"
   - **ID**: "customdeploy_sso_auth"
   - **Status**: Released
   - **Audience**: All Roles
   - **Execute As Role**: Administrator

## Step 2: Configure Environment Variables

Set the following environment variables in your Replit project:

```bash
# NetSuite Suitelet SSO Configuration
NETSUITE_ACCOUNT_ID=1212804
NETSUITE_SSO_SECRET=your_base64_encoded_secret_here
NETSUITE_SSO_SCRIPT_ID=4354  # Your script internal ID
NETSUITE_SSO_DEPLOY_ID=1     # Your deployment internal ID
```

### 2.1 Generate Shared Secret
Generate a secure random secret for JWT signing:
```bash
# Generate a random 256-bit key and base64 encode it
openssl rand -base64 32
```

## Step 3: Update SuiteScript with JWT Library

For production use, you'll need to implement proper JWT signing in the SuiteScript. Here's a more complete version:

**Enhanced sso_suitelet.js:**
```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/runtime', 'N/https', 'N/crypto'], function(runtime, https, crypto) {
    
    // Your shared secret (should match NETSUITE_SSO_SECRET)
    var SHARED_SECRET = 'your_base64_shared_secret_here';
    
    function onRequest(context) {
        var response = context.response;
        
        try {
            var currentUser = runtime.getCurrentUser();
            
            var payload = {
                name: currentUser.name,
                email: currentUser.email,
                customerId: currentUser.id.toString(),
                entityId: currentUser.entity ? currentUser.entity.toString() : null,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600
            };
            
            var token = createJWT(payload);
            
            var redirectUrl = 'http://localhost:5000/api/auth/netsuite/sso?sso_token=' + encodeURIComponent(token);
            response.sendRedirect({
                type: https.RedirectType.EXTERNAL,
                url: redirectUrl
            });
            
        } catch (error) {
            log.error('SSO Error', error.toString());
            response.write('Authentication failed');
        }
    }
    
    function createJWT(payload) {
        var header = { alg: "HS256", typ: "JWT" };
        
        var encodedHeader = base64urlEncode(JSON.stringify(header));
        var encodedPayload = base64urlEncode(JSON.stringify(payload));
        var message = encodedHeader + '.' + encodedPayload;
        
        // Create HMAC signature
        var hmac = crypto.createHmac({
            algorithm: crypto.HashAlg.SHA256,
            key: SHARED_SECRET
        });
        hmac.update({ input: message });
        var signature = base64urlEncode(hmac.digest());
        
        return message + '.' + signature;
    }
    
    function base64urlEncode(str) {
        if (typeof str === 'string') {
            return btoa(str)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
        } else {
            // For crypto digest
            return str.replace(/\+/g, '-')
                      .replace(/\//g, '_')
                      .replace(/=/g, '');
        }
    }
    
    return {
        onRequest: onRequest
    };
});
```

## Step 4: Test the Integration

1. Set your environment variables in Replit
2. Start your application
3. Click "Sign in with NetSuite SSO" 
4. You should be redirected to: 
   `https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=4354&deploy=1`
5. After NetSuite authentication, you should be redirected back with a JWT token

## Troubleshooting

### Common Issues:
1. **Script not found**: Check script ID and deployment ID in environment variables
2. **Permission denied**: Ensure the deployment audience includes your user role
3. **JWT verification fails**: Verify the shared secret matches between SuiteScript and application
4. **Redirect fails**: Check the redirect URL in the SuiteScript matches your application domain

### Debug Steps:
1. Check NetSuite script execution logs
2. Verify environment variables are set correctly
3. Test JWT token generation manually
4. Check application logs for verification errors

## Security Notes

1. **Shared Secret**: Keep the JWT signing secret secure and never expose it in client-side code
2. **Token Expiration**: Tokens expire after 1 hour by default
3. **HTTPS**: Use HTTPS in production for all redirects
4. **Domain Validation**: Consider adding domain validation in the SuiteScript to prevent misuse

## Migration from OAuth 2.0

If you're migrating from OAuth 2.0:
1. Remove old OAuth environment variables (NETSUITE_CLIENT_ID, NETSUITE_CLIENT_SECRET)
2. Set new SSO environment variables as shown above
3. Test the new flow thoroughly
4. Update any documentation to reflect the new authentication method