# NetSuite SSO Troubleshooting Guide

## Problem: "You do not have privileges to view this page" Error

This error occurs when the NetSuite Suitelet deployment settings are misconfigured. The issue is that the Suitelet is not accessible to users who aren't already logged into NetSuite.

## Root Cause

The Suitelet deployment is currently configured with:
- **Script ID**: 4389
- **Deploy ID**: 1
- **Account ID**: 1212804

But the deployment settings in NetSuite need to be adjusted.

## Solution 1: Fix Suitelet Deployment Settings (Recommended)

### Step 1: Update Suitelet Deployment in NetSuite

1. **Login to NetSuite** as an Administrator
2. Go to **Customization → Scripting → Scripts**
3. Find your SSO Suitelet (Script ID: 4389)
4. Click **Edit** on the deployment
5. Update these critical settings:

#### For Initial Setup/Testing:
```
Title: SSO Authentication
ID: customdeploy_sso_auth (or your deploy ID)
Status: Released
Audience: All Roles ✓ (IMPORTANT: Change this from "Customer Center Users")
Available Without Login: Yes ✓ (CRITICAL: Must be Yes for SSO to work)
Execute As Role: Current User (NOT Administrator or Customer Center)
```

#### Why These Settings:
- **Audience: All Roles** - Allows any user to access the Suitelet
- **Available Without Login: Yes** - Allows users to access the Suitelet without being logged into NetSuite first (this is required for SSO)
- **Execute As Role: Current User** - Runs with the permissions of the authenticated user

### Step 2: Save and Test

After saving the deployment:
1. Clear your browser cache
2. Try the SSO login again from the customer portal

## Solution 2: Alternative - Two-Stage Deployment

If you need to maintain customer center security, create two deployments:

### Deployment 1: Public SSO Entry Point
```
ID: customdeploy_sso_public
Audience: All Roles
Available Without Login: Yes
Execute As Role: Current User
URL Suffix: &deploy=1
```

### Deployment 2: Customer Center Only (After Authentication)
```
ID: customdeploy_sso_customer
Audience: Customer Center Users
Available Without Login: No
Execute As Role: Customer Center
URL Suffix: &deploy=2
```

## Solution 3: Direct NetSuite Login First

If security requirements prevent "Available Without Login: Yes":

1. Users must first go to: `https://1212804.app.netsuite.com/`
2. Login with their NetSuite credentials
3. Then use the SSO button in the customer portal

## Common Configuration Mistakes

### ❌ Wrong Configuration:
```
Audience: Customer Center Users
Available Without Login: No
Execute As Role: Administrator
```
**Result**: "You do not have privileges" error without login prompt

### ✅ Correct Configuration for SSO:
```
Audience: All Roles
Available Without Login: Yes
Execute As Role: Current User
```
**Result**: Users can access Suitelet and authenticate

## Verification Steps

### Check Current Suitelet URL:
The system is generating:
```
https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=4389&deploy=1
```

### Test Access Directly:
1. Open the URL directly in your browser
2. If you get "You do not have privileges", the deployment settings are wrong
3. If you get a login prompt or the Suitelet executes, settings are correct

## Security Considerations

Setting "Available Without Login: Yes" is standard for SSO Suitelets because:
1. The Suitelet itself handles authentication
2. It only generates a JWT token after successful NetSuite login
3. The token contains user identification from NetSuite's authenticated session
4. No sensitive data is exposed without authentication

## Environment Variables to Check

Ensure these are correctly set in your Replit environment:
```
NETSUITE_ACCOUNT_ID=1212804
NETSUITE_SSO_SCRIPT_ID=4389
NETSUITE_SSO_DEPLOY_ID=1
NETSUITE_SSO_SECRET=<your-shared-secret>
```

## If Problems Persist

1. **Check NetSuite Execution Log**:
   - Go to Customization → Scripting → Script Execution Log
   - Look for errors from your Suitelet

2. **Verify User Permissions**:
   - Ensure the user has a role with web access
   - Check if customer record is active

3. **Test with Administrator Account**:
   - Try logging in with a NetSuite admin account first
   - If it works, the issue is role-specific

## Contact Support

If none of these solutions work, the issue may be:
- NetSuite account configuration
- Script deployment limits
- Custom role restrictions

Contact your NetSuite administrator to verify the Suitelet deployment settings.