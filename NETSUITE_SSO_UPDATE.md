# NetSuite Suitelet SSO Update Required

## Current Status
✅ **Fixed**: SSO authentication is now working with proper Replit domain redirect
✅ **Fixed**: JWT token verification is successful (moved from "invalid signature" to "jwt expired")
✅ **Fixed**: Callback URL now includes proper Replit domain: `8ae361fb-6ae3-4428-bdcb-35ba3f53f886-00-v5e1qu1mb6wj.worf.replit.dev`

## Required NetSuite Suitelet Update

Your NetSuite Suitelet script (Script ID: 4389, Deploy ID: 1) needs to be updated to use the `callback` parameter for redirects.

### Current NetSuite URL Structure
```
https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=4389&deploy=1&callback=https%3A%2F%2F8ae361fb-6ae3-4428-bdcb-35ba3f53f886-00-v5e1qu1mb6wj.worf.replit.dev%2Fapi%2Fauth%2Fnetsuite%2Fsso
```

### Suitelet Code Update Needed

In your NetSuite Suitelet script, update the redirect logic to use the callback parameter:

```javascript
// In your Suitelet's onRequest function
function onRequest(context) {
    if (context.request.method === 'GET') {
        // Get the callback URL from the request parameters
        var callbackUrl = context.request.parameters.callback || 
                         'http://localhost:5000/api/auth/netsuite/sso'; // fallback
        
        // ... your existing authentication logic ...
        
        // After generating the JWT token, redirect to the callback URL
        var jwtToken = generateJWT(userInfo); // your existing JWT generation
        
        var redirectUrl = callbackUrl + '?sso_token=' + encodeURIComponent(jwtToken);
        context.response.sendRedirect({
            url: redirectUrl
        });
    }
}
```

### Why This Update Is Needed
- Previously, the Suitelet was redirecting to `localhost:5000` which doesn't work in the Replit environment
- The new callback parameter provides the correct Replit domain for redirects
- This ensures users stay within the Replit environment during the SSO flow

### Testing After Update
1. Click "Sign in with NetSuite SSO" in the application
2. You'll be redirected to NetSuite (staying in the same browser tab)
3. After authenticating in NetSuite, you'll be redirected back to the Replit application
4. You should be automatically logged in

## Current SSO Environment Configuration
- **Account ID**: 1212804
- **Script ID**: 4389 (configured via NETSUITE_SSO_SCRIPT_ID)
- **Deploy ID**: 1 (configured via NETSUITE_SSO_DEPLOY_ID)
- **Shared Secret**: ✅ Configured and working
- **Replit Domain**: 8ae361fb-6ae3-4428-bdcb-35ba3f53f886-00-v5e1qu1mb6wj.worf.replit.dev