# NetSuite Token Diagnosis: Blank Role Field

## Issue Identified
Login Audit Trail shows failed authentication with **blank 'role' field**.

## What This Means
The blank role field indicates NetSuite cannot determine what permissions/role to assign to your token. This is a critical clue that points to token-level issues rather than signature problems.

## Immediate Checks Needed

### 1. Access Token Status
**Location:** Setup → Users/Roles → Access Tokens
**Find:** Token ID `355e63bf...`

**Check These Fields:**
- [ ] **Status**: Must be "Active" (not "Inactive" or "Revoked")
- [ ] **Expiration Date**: Must be in the future
- [ ] **User**: The associated user must be active
- [ ] **Role**: Must have a role assigned (not blank)
- [ ] **Application**: Must match your integration

### 2. Associated User Status  
**Location:** Setup → Users/Roles → Manage Users
**Find:** The user associated with your token

**Verify:**
- [ ] User status is "Active" (not "Inactive" or "Disabled")
- [ ] User has appropriate roles assigned
- [ ] User has "Web Services" permission checked
- [ ] User account hasn't been locked or suspended

### 3. Integration Record
**Location:** Setup → Integration → Manage Integrations  
**Find:** Consumer Key `56880141...`

**Confirm:**
- [ ] Integration state is "Enabled"
- [ ] "Token-based Authentication" is checked
- [ ] User permissions include your token's user
- [ ] Permissions include "REST Web Services"

### 4. Role Permissions
**Location:** Setup → Users/Roles → Manage Roles
**Find:** The role assigned to your token's user

**Verify Role Has:**
- [ ] "Web Services" permission
- [ ] "REST Web Services" permission  
- [ ] "SuiteScript" permission (if needed)
- [ ] Appropriate record-level permissions

## Most Likely Causes (In Order)

1. **Token Expired/Revoked**: Check expiration date in Access Tokens
2. **User Inactive**: Associated user account disabled
3. **Missing Role Assignment**: Token user has no active roles
4. **Integration Disabled**: The integration record is inactive
5. **Insufficient Permissions**: Role lacks Web Services access

## Quick Fix Steps

### Step 1: Verify Token Status
1. Go to Setup → Users/Roles → Access Tokens
2. Search for token ID: `355e63bf`
3. If status is not "Active", you need to:
   - Regenerate the token, OR
   - Reactivate the existing token

### Step 2: Check User Account
1. Note the "User" field from the token record
2. Go to Setup → Users/Roles → Manage Users
3. Find that user and verify they're active
4. Check their role assignments

### Step 3: Verify Role Permissions
1. From the user record, note their assigned roles
2. Go to Setup → Users/Roles → Manage Roles  
3. Edit each role and verify "Web Services" is checked
4. Save if you made changes

## Testing After Changes
After making any changes in NetSuite:
1. Wait 2-3 minutes for changes to propagate
2. Test using: `curl http://localhost:5000/api/netsuite/test`
3. Check console logs for success/failure
4. Verify Login Audit Trail now shows a role (not blank)

## If Token Needs Regeneration
If the token is expired/revoked:
1. Delete the old access token
2. Create a new access token with same user
3. Update your environment variables:
   - NETSUITE_TOKEN_ID
   - NETSUITE_TOKEN_SECRET
4. Restart the application