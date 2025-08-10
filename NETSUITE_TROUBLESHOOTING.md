# NetSuite Integration Troubleshooting Guide

## Current Status

The NetSuite integration is properly configured with enhanced logging and debugging tools, but authentication is failing due to token rejection from NetSuite.

## Enhanced Logging Features

### Console Logging
The application now provides detailed console logging for NetSuite operations:
- 🔍 Connection test initiation
- 📍 Account ID and URL information
- 🔑 Credential status (partial display for security)
- 🔐 OAuth signature generation details
- ⏰ Timestamps and nonces
- ✍️ Generated signatures
- 📡 Response status and headers
- ❌ Detailed error responses
- 🔒 Authentication headers

### Debug Endpoints

#### `/api/netsuite/test`
- Tests actual API connection
- Returns detailed error information
- Shows authentication status

#### `/api/netsuite/debug` 
- Configuration status check
- Environment variable verification
- Debug information display

### Debug Pages

#### `/netsuite-debug`
- Comprehensive visual debugging interface
- Configuration status display
- Environment variable check
- Connection testing with detailed results
- Current issue explanation and troubleshooting steps

#### `/netsuite-test`
- Existing visual testing interface
- Basic connection verification

## Current Authentication Issue

### Error Details
```
Status: 401 Unauthorized
Error: token_rejected
Description: Invalid login attempt
Error Code: INVALID_LOGIN
```

### Technical Analysis

The OAuth 1.0a signature generation is working correctly:
- Proper timestamp and nonce generation
- Correct parameter ordering and encoding
- Valid signature base string construction
- Proper HMAC-SHA256 signature calculation
- Correct authorization header formatting

However, NetSuite is rejecting the token itself, indicating:
- Token credentials may be incorrect or expired
- Integration may not be properly configured in NetSuite
- Token permissions may be insufficient
- Account access may be restricted

### Debugging Steps Completed

1. ✅ Enhanced logging implementation
2. ✅ Debug endpoints creation
3. ✅ Visual debugging interface
4. ✅ OAuth signature verification
5. ✅ Environment variable validation
6. ✅ Configuration status checking

### Next Steps Required

1. **Verify Token Credentials in NetSuite**
   - Log into NetSuite admin panel
   - Check integration record status
   - Verify token credentials are active
   - Confirm permissions are properly set

2. **Check NetSuite Login Audit Trail**
   - Navigate to: Setup → Users/Roles → User Management → View Login Audit Trail
   - Look for failed authentication attempts
   - Check for any specific error messages or restrictions

3. **Verify Integration Setup**
   - Ensure the integration record is active
   - Check that the consumer key/secret match
   - Verify token permissions include REST API access
   - Confirm account has appropriate licensing

4. **Test with Different Endpoints**
   - Try different NetSuite REST endpoints
   - Test with different HTTP methods
   - Verify account-specific restrictions

## How to Use Debug Tools

### Console Logs
1. Open browser developer tools
2. Navigate to Console tab
3. Visit `/api/netsuite/test` endpoint
4. Look for detailed emoji-marked log entries

### Debug Page
1. Navigate to `/netsuite-debug` in the application
2. Review configuration status
3. Check environment variables
4. Run connection test
5. View detailed error information

### API Endpoints
```bash
# Test connection
curl http://localhost:5000/api/netsuite/test

# Get debug information  
curl http://localhost:5000/api/netsuite/debug
```

## Success Indicators

When the issue is resolved, you should see:
- ✅ Success status in debug page
- ✅ Connection test returns HTTP 200
- ✅ Console logs show successful API response
- ✅ Metadata catalog data returned from NetSuite

## Support Information

If the issue persists after checking NetSuite configuration:
1. Contact NetSuite support with the specific error details
2. Provide the OAuth signature and request details from console logs
3. Reference the Login Audit Trail entries
4. Mention the error code: INVALID_LOGIN