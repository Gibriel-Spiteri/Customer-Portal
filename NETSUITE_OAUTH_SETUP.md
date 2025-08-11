# NetSuite OAuth 2.0 Setup Guide

## Overview
This application now uses true NetSuite OAuth 2.0 Single Sign-On (SSO) for authentication. Users authenticate directly with NetSuite, eliminating the need for storing or validating passwords in our application.

## Prerequisites
1. NetSuite account with Administrator or Integration Developer role
2. Access to NetSuite Setup menu
3. Valid NetSuite account ID (e.g., 1212804)

## Step 1: Create OAuth 2.0 Integration in NetSuite

### 1.1 Navigate to Integration Setup
1. Log in to NetSuite as Administrator
2. Go to **Setup → Integration → Manage Integrations**
3. Click **New**

### 1.2 Configure Integration
1. **Name**: Customer Portal OAuth Integration
2. **State**: Enabled
3. **Integration Type**: Select "OAuth 2.0"
4. **Authentication**: 
   - Check "Authorization Code Grant"
   - Check "Use PKCE" (recommended for additional security)
5. **Redirect URI**: 
   - Development: `http://localhost:5000/api/auth/netsuite/callback`
   - Production: `https://your-domain.replit.app/api/auth/netsuite/callback`
6. **Scopes**: Select the following:
   - REST Web Services
   - SuiteAnalytics Workbook
   - User Access: Customers (if available)
7. **Token Duration**: Set as needed (default: 60 minutes)
8. **Refresh Token Duration**: Set as needed (default: 7 days)

### 1.3 Save and Note Credentials
After saving, NetSuite will display:
- **Client ID**: Save this as `NETSUITE_CLIENT_ID`
- **Client Secret**: Save this as `NETSUITE_CLIENT_SECRET`

**Important**: The Client Secret is only shown once. Save it immediately!

## Step 2: Configure Application Environment

### 2.1 Set Environment Variables
In your Replit Secrets or .env file, add:

```bash
# NetSuite OAuth 2.0 Configuration
NETSUITE_ACCOUNT_ID=1212804  # Your NetSuite account ID
NETSUITE_CLIENT_ID=your_client_id_here
NETSUITE_CLIENT_SECRET=your_client_secret_here

# Optional: Set base URL for production
BASE_URL=https://your-app.replit.app
```

### 2.2 Remove Old OAuth 1.0 Tokens
Delete these deprecated environment variables if they exist:
- `NETSUITE_CONSUMER_KEY`
- `NETSUITE_CONSUMER_SECRET`
- `NETSUITE_TOKEN_ID`
- `NETSUITE_TOKEN_SECRET`

## Step 3: User Permissions in NetSuite

### 3.1 Customer Center Role
Ensure customers have appropriate roles:
1. Go to **Setup → Users/Roles → Manage Roles**
2. Find or create a "Customer Center" role
3. Ensure it has permissions for:
   - Login Using Access Tokens
   - REST Web Services
   - Customer Center Access

### 3.2 Assign Role to Customers
1. Go to **Lists → Relationships → Customers**
2. Edit customer record
3. Under **Access** tab, ensure:
   - "Give Access" is checked
   - Customer Center role is assigned
   - Login credentials are set up

## Step 4: Test the OAuth Flow

### 4.1 Initiate Login
1. Navigate to your application's login page
2. Click "Sign in with NetSuite SSO"
3. You should be redirected to NetSuite's login page

### 4.2 Authenticate
1. Enter NetSuite credentials
2. Approve the integration (first time only)
3. You'll be redirected back to the application

### 4.3 Verify Session
After successful authentication, check:
- User is logged in to the portal
- User information is displayed correctly
- API calls to NetSuite work properly

## Troubleshooting

### Common Issues

#### 1. "OAuth 2.0 not configured" Error
**Solution**: Ensure `NETSUITE_CLIENT_ID` and `NETSUITE_CLIENT_SECRET` are set in environment variables.

#### 2. "Invalid redirect URI" Error
**Solution**: The redirect URI in NetSuite must exactly match your application's callback URL.

#### 3. "Invalid client credentials" Error
**Solution**: Verify Client ID and Secret are correct and the integration is enabled in NetSuite.

#### 4. User Can't Authenticate
**Solution**: Check that the customer has:
- An active NetSuite account
- Customer Center access enabled
- Valid login credentials

#### 5. Token Expiration
**Solution**: The application automatically handles token refresh. If issues persist, user may need to re-authenticate.

## Security Best Practices

1. **Use HTTPS in Production**: Always use HTTPS for redirect URIs in production
2. **Enable PKCE**: Adds extra security to the OAuth flow
3. **Limit Scopes**: Only request necessary permissions
4. **Secure Storage**: Never commit Client Secret to version control
5. **Token Rotation**: Configure appropriate token lifetimes

## Migration from Old Authentication

### What Changed
- **Before**: Application stored passwords and used OAuth 1.0a tokens for API access
- **Now**: Users authenticate directly with NetSuite via OAuth 2.0

### Benefits
1. **True SSO**: Users sign in with their NetSuite credentials
2. **No Password Storage**: Application never sees or stores user passwords
3. **Better Security**: OAuth 2.0 with PKCE is more secure
4. **Automatic Token Management**: Tokens refresh automatically
5. **User Control**: Users can revoke access from NetSuite

### Impact on Users
- First-time users will be redirected to NetSuite for authentication
- Existing users may need to re-authenticate
- No more password fields for NetSuite login
- Single button click to authenticate

## Support

For additional help:
1. Check NetSuite's OAuth 2.0 documentation
2. Review the Login Audit Trail in NetSuite
3. Check application logs for detailed error messages
4. Contact NetSuite support for integration issues