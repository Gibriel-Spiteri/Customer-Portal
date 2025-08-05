# NetSuite API Integration Setup Instructions

## Prerequisites
- Administrator access to your NetSuite account
- NetSuite account ID (found in Setup > Company > Company Information)

## Step 1: Enable Token-Based Authentication

1. Log in to NetSuite as an Administrator
2. Go to **Setup > Company > Enable Features**
3. Click the **SuiteCloud** tab
4. Under **Manage Authentication**, check the box for **TOKEN-BASED AUTHENTICATION**
5. Click **Save**

## Step 2: Create an Integration Record

1. Go to **Setup > Integration > Manage Integrations > New**
2. Fill in the following fields:
   - **Name**: Customer Portal Integration (or any descriptive name)
   - **State**: Enabled
   - Check the box for **TOKEN-BASED AUTHENTICATION**
   - Uncheck **TBA: AUTHORIZATION FLOW** (we're using direct token auth)
   - Check **RESTLETS** and **REST WEB SERVICES**
3. Click **Save**
4. **IMPORTANT**: Copy and save the following values shown on the confirmation page:
   - **CONSUMER KEY** → This is your NETSUITE_CONSUMER_KEY
   - **CONSUMER SECRET** → This is your NETSUITE_CONSUMER_SECRET

⚠️ **Note**: The Consumer Secret is only shown once. Make sure to copy it now!

## Step 3: Create Access Tokens

1. Go to **Setup > Users/Roles > Access Tokens > New**
2. Fill in the following:
   - **Application Name**: Select the integration you created in Step 2
   - **User**: Select the user account that will access the API (usually your account)
   - **Role**: Select an appropriate role with permissions to view estimates, orders, etc.
   - **Token Name**: Customer Portal Token (or any descriptive name)
3. Click **Save**
4. **IMPORTANT**: Copy and save the following values:
   - **TOKEN ID** → This is your NETSUITE_TOKEN_ID
   - **TOKEN SECRET** → This is your NETSUITE_TOKEN_SECRET

⚠️ **Note**: The Token Secret is only shown once. Make sure to copy it now!

## Step 4: Verify Role Permissions

Make sure the role assigned in Step 3 has the following permissions:
- **Lists > Customers**: View
- **Transactions > Estimate**: View
- **Transactions > Sales Order**: View
- **Transactions > Invoice**: View
- **Transactions > Customer Payment**: View

To check/modify permissions:
1. Go to **Setup > Users/Roles > Manage Roles**
2. Edit the role used in Step 3
3. Under **Permissions**, ensure the above permissions are granted

## Summary

After completing these steps, you should have:
1. **NETSUITE_CONSUMER_KEY**: From the Integration Record
2. **NETSUITE_CONSUMER_SECRET**: From the Integration Record
3. **NETSUITE_TOKEN_ID**: From the Access Token
4. **NETSUITE_TOKEN_SECRET**: From the Access Token

These four values are required for the Customer Portal to authenticate with NetSuite and fetch your data.

## Troubleshooting

- If you don't see the Integration menu, make sure you have Administrator access
- If Token-Based Authentication is not available, check your NetSuite subscription level
- For "Invalid login attempt" errors, verify the role has the necessary permissions
- Ensure the user account is active and not locked