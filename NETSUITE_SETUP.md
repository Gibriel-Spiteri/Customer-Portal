# NetSuite OAuth 2.0 Authentication Setup

This guide explains how to configure NetSuite OAuth 2.0 authentication for the customer portal, allowing customers to login with their existing NetSuite credentials.

## Prerequisites

1. **NetSuite Administrator Access** - You need admin access to configure OAuth integration
2. **NetSuite Account with REST Web Services enabled**
3. **Customer Portal features enabled in NetSuite**

## Step 1: Enable Required Features in NetSuite

1. Navigate to **Setup > Company > Enable Features**
2. Go to the **SuiteCloud** tab
3. Enable the following features:
   - ✅ **REST Web Services** (in SuiteTalk section)
   - ✅ **OAuth 2.0** (in Manage Authentication section)
   - ✅ **SuiteAnalytics Workbook** (in Analytics tab)

## Step 2: Configure Role Permissions

1. Go to **Setup > Users/Roles > Manage Roles**
2. Edit the Customer role or create a new role for customer portal access
3. Set the following permissions:
   - **REST Web Services**: Full
   - **Log in using Access Tokens**: Full
   - **Customer Records**: View (own records only)
   - **Transaction Records**: View (own records only)
   - **Support Cases**: View/Edit (own records only)

## Step 3: Create Integration Record

1. Navigate to **Setup > Integration > Manage Integrations**
2. Click **New**
3. Configure the integration:
   - **Name**: Customer Portal OAuth Integration
   - **State**: Enabled
   - **Description**: OAuth integration for customer portal authentication

4. On the **Authentication** tab:
   - ✅ Check **Authorization Code Grant (OAuth 2.0)**
   - ✅ Check **REST Web Services**
   - **Redirect URI**: `http://localhost:5000/auth/netsuite/callback` (for development)
   - **Scope**: `rest_webservices`

5. **Save** the integration record

6. **Important**: Copy the following values that appear after saving:
   - **Consumer Key/Client ID**
   - **Consumer Secret/Client Secret**
   - **Account ID** (from your NetSuite URL: `https://[ACCOUNT_ID].app.netsuite.com`)

## Step 4: Production Deployment Setup

For production deployment, update the **Redirect URI** to:
```
https://your-production-domain.com/auth/netsuite/callback
```

## Required Environment Variables

The application needs these environment variables to connect to NetSuite:

- `NETSUITE_ACCOUNT_ID`: Your NetSuite account ID
- `NETSUITE_CLIENT_ID`: Consumer Key from the integration record
- `NETSUITE_CLIENT_SECRET`: Consumer Secret from the integration record
- `NETSUITE_REDIRECT_URI`: The callback URL for OAuth flow

## How the Authentication Flow Works

1. **Customer clicks "Sign in with NetSuite"** on the login page
2. **Redirect to NetSuite**: Customer is redirected to NetSuite's OAuth authorization page
3. **Customer Authentication**: Customer enters their NetSuite credentials
4. **Authorization Grant**: NetSuite redirects back with an authorization code
5. **Token Exchange**: Server exchanges the code for access and refresh tokens
6. **Customer Data Retrieval**: Server fetches customer information from NetSuite
7. **Portal Access**: Customer is logged into the portal with their NetSuite data

## Security Features

- **PKCE (Proof Key for Code Exchange)**: Enhances security for OAuth flow
- **State Parameter Verification**: Prevents CSRF attacks
- **Secure Cookie Storage**: OAuth state and code verifier stored in secure cookies
- **Token Refresh**: Automatic token refresh for extended sessions
- **JWT Integration**: NetSuite authentication integrates with existing JWT system

## Troubleshooting

### Common Issues

1. **"Invalid Client" Error**
   - Verify Client ID and Client Secret are correct
   - Check that the integration record is enabled

2. **"Invalid Redirect URI" Error**
   - Ensure the redirect URI in NetSuite matches exactly
   - Check for trailing slashes and protocol (http vs https)

3. **"Insufficient Permissions" Error**
   - Verify the customer role has appropriate permissions
   - Check that REST Web Services permission is set to Full

4. **"Account ID Not Found" Error**
   - Verify the NETSUITE_ACCOUNT_ID matches your NetSuite account

### Testing the Integration

1. Ensure all environment variables are set
2. Start the development server
3. Navigate to the login page
4. Click "Sign in with NetSuite"
5. You should be redirected to NetSuite's login page
6. After successful login, you'll be redirected back to the portal

## Benefits of NetSuite OAuth Integration

- **Seamless User Experience**: No need to remember separate credentials
- **Enhanced Security**: No password storage, uses OAuth 2.0 standard
- **Real-time Data**: Direct access to customer's NetSuite data
- **Single Sign-On**: Integration with existing NetSuite authentication
- **Automatic Provisioning**: Customer accounts created automatically from NetSuite data

## Production Considerations

- Use HTTPS for all production URLs
- Store client secrets securely (environment variables, not in code)
- Implement proper error handling and logging
- Consider token refresh strategies for long-lived sessions
- Monitor OAuth usage for rate limiting compliance