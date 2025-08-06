# NetSuite Token Authentication Troubleshooting Guide

## Current Status
- ✅ OAuth signature generation: Working correctly
- ✅ URL formatting: Correct (`https://1212804.suitetalk.api.netsuite.com/`)
- ✅ Credentials loading: Consumer Key and Token ID updated and loading properly
- ❌ Authentication: NetSuite returning `error="token_rejected"` for all endpoints

## Root Cause Analysis

The consistent `token_rejected` error across all REST endpoints indicates the issue is with the NetSuite integration setup, not the OAuth implementation.

## Required NetSuite Configuration Checklist

### 1. Integration Record Setup
**Location**: Setup > Integration > Manage Integrations

Verify your integration record has:
- [x] **State**: Enabled
- [x] **Token-Based Authentication**: Checked/Enabled
- [x] **REST Web Services**: Checked/Enabled
- [x] **User Credentials**: Should NOT be checked (conflicts with token auth)

### 2. Access Token Configuration
**Location**: Setup > Integration > Manage Integrations > [Your Integration] > Access Tokens

For your access token:
- [x] **Token Status**: Active/Enabled
- [x] **User**: Must be an active user with appropriate role
- [x] **Role**: Must have REST permissions (see #3 below)

### 3. User Role Permissions
**Location**: Setup > Users/Roles > Manage Roles > [Token User's Role]

Required permissions for the token user's role:
- [x] **REST Web Services**: Full access
- [x] **Lists > Company Information**: View permission
- [x] **Lists > Subsidiaries**: View permission  
- [x] **Lists > Currencies**: View permission
- [x] **Lists > Accounts**: View permission
- [x] **Lists > Customers**: View permission (for customer portal)

### 4. Company Preferences
**Location**: Setup > Company > Enable Features

Ensure these features are enabled:
- [x] **SuiteCloud > REST Web Services**: Checked
- [x] **SuiteCloud > Token-Based Authentication**: Checked

## Troubleshooting Steps

### Step 1: Check Integration Record
1. Go to Setup > Integration > Manage Integrations
2. Find your integration record
3. Verify "Token-Based Authentication" is checked
4. Verify "REST Web Services" is checked
5. **Important**: Ensure "User Credentials" is NOT checked

### Step 2: Regenerate Access Tokens
1. In the integration record, go to "Access Tokens" tab
2. Delete the existing token
3. Create a new access token
4. Select a user with Administrator or full REST permissions
5. Copy the new Token ID and Token Secret

### Step 3: Check User Role
1. Go to the user assigned to the token
2. Check their role has "REST Web Services" permission
3. Check role has view permissions for required record types

### Step 4: Test with Simple Endpoint
After making changes, test with a simple endpoint like `/currency` or `/account` first.

## Common Issues and Solutions

### "Token-Based Authentication" Option Missing
- **Cause**: Feature not enabled at company level
- **Solution**: Setup > Company > Enable Features > SuiteCloud > Token-Based Authentication

### Token User Has No Permissions
- **Cause**: Token user's role lacks REST permissions
- **Solution**: Assign Administrator role or create custom role with full REST access

### Integration Record Conflicts
- **Cause**: Both "User Credentials" and "Token-Based Authentication" checked
- **Solution**: Uncheck "User Credentials", use only Token-Based Authentication

## Testing Commands

After making NetSuite changes, test with:

```bash
node test-netsuite-simple.js
```

Success indicators:
- Response status: 200
- No "token_rejected" error
- Actual data returned instead of error messages

## Next Steps

1. **Check NetSuite Login Audit Trail** (Setup > Users/Roles > User Management > View Login Audit Trail)
2. **Verify integration settings** against the checklist above
3. **Regenerate tokens** if configuration looks correct
4. **Test with a different user/role** if the current user has issues