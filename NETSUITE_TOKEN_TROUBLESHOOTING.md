# NetSuite Token Troubleshooting

## Current Issue: Blank Page After NetSuite Login

### Symptom
After successfully logging into NetSuite, the user is redirected back but sees a blank page instead of the expected content.

### Investigation Results

1. **Authentication Flow**:
   - User clicks "Sign in with NetSuite SSO"
   - Redirected to NetSuite Suitelet
   - NetSuite authenticates user
   - NetSuite redirects back to `/api/auth/netsuite/sso?sso_token=TOKEN`
   - Backend receives token but fails to verify with "jwt malformed" error
   - User is redirected to `/login?error=jwt%20malformed`
   - Page appears blank

2. **Root Cause**: 
   The JWT token from NetSuite is not being properly verified due to either:
   - Token format issues from the Suitelet
   - Secret mismatch between Suitelet and application

### Common JWT Issues and Solutions

## 1. Token Format Issues

### Check: Is the Suitelet generating a proper JWT?

A valid JWT should have this structure:
```
header.payload.signature
```

Example:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### Possible Suitelet Issues:

1. **Base64 Encoding**: The Suitelet might not be properly base64url encoding the token parts
2. **Signature Generation**: The HMAC signature might not be generated correctly
3. **Secret Format**: The secret in the Suitelet might not match what's in the environment variable

## 2. Debug Steps

### Step 1: Check Token Structure
The application now logs:
- Whether a token was received
- Token length
- Number of parts (should be 3)

Check the browser console and server logs for these messages.

### Step 2: Verify Secret Match

In your NetSuite Suitelet, ensure the `SHARED_SECRET` variable exactly matches your `NETSUITE_SSO_SECRET` environment variable.

**Suitelet (line ~12):**
```javascript
var SHARED_SECRET = 'YOUR_BASE64_SHARED_SECRET_HERE';
```

**Environment Variable:**
```
NETSUITE_SSO_SECRET=YOUR_BASE64_SHARED_SECRET_HERE
```

These must be EXACTLY the same, including:
- Same encoding (base64, hex, or plain text)
- Same characters (no extra spaces)
- Same case (uppercase/lowercase)

### Step 3: Test Token Generation

Create a test token to verify the Suitelet is working:

1. In NetSuite, create a test Suitelet that just generates and displays a token:

```javascript
var testPayload = {
    name: "Test User",
    email: "test@example.com",
    customerId: "12345",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
};

var token = createJWT(testPayload);
response.write('Token: ' + token);
```

2. Copy the token and test it with a JWT decoder (jwt.io) to verify structure

## 3. Quick Fix Options

### Option A: Use Plain Text Secret (Simplest)

1. Generate a simple secret:
```
MySimpleSecret123
```

2. Update Suitelet:
```javascript
var SHARED_SECRET = 'MySimpleSecret123';
```

3. Update environment variable:
```
NETSUITE_SSO_SECRET=MySimpleSecret123
```

### Option B: Use Base64 Secret (More Secure)

1. Generate a base64 secret:
```bash
echo -n "MySecretKey123" | base64
# Output: TXlTZWNyZXRLZXkxMjM=
```

2. Update Suitelet:
```javascript
var SHARED_SECRET = 'TXlTZWNyZXRLZXkxMjM=';
```

3. Update environment variable:
```
NETSUITE_SSO_SECRET=TXlTZWNyZXRLZXkxMjM=
```

## 4. Blank Page Fix

The blank page is now fixed with error handling in the login page. If you still see a blank page:

1. Open browser developer console (F12)
2. Check for JavaScript errors
3. Check Network tab for failed requests
4. Look for console logs starting with "Login page:" or "SSO:"

## 5. Testing After Fix

Once you've updated the secret:

1. Clear browser cache and cookies
2. Try SSO login again
3. Check server logs for debugging output
4. If token verification succeeds, you should be redirected to the dashboard

## 6. If Still Not Working

Check these common issues:

1. **NetSuite Script Execution**:
   - Go to Customization → Scripting → Script Execution Log
   - Look for errors from your Suitelet

2. **Token Content**:
   - The token might be URL encoded twice
   - Check if token contains `%` characters

3. **Redirect URL**:
   - Ensure the callback URL in Suitelet matches your application URL
   - Check for http vs https mismatches

## Need More Help?

If the issue persists after these steps:

1. Share the server logs showing the SSO debugging output
2. Check the NetSuite Script Execution Log for errors
3. Verify the Suitelet code matches the example provided
4. Ensure environment variables are properly set in Replit