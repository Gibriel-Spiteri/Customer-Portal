# NetSuite User Account Checklist

The user account is a critical component for Token-Based Authentication. Here's what to check:

## 1. User Account Status
**Go to:** Setup > Users/Roles > Manage Users

Find the user you selected for the access token and verify:
- [ ] **Access** status is "Full" (not "Restricted" or "None")
- [ ] **Login Access** is enabled (checkbox is checked)
- [ ] Account is not locked or expired
- [ ] User has a valid email address

## 2. User Role Assignment
Still in the user record, check the **Access** tab:
- [ ] User has **Administrator** role assigned
- [ ] Role is set as **Primary** (if multiple roles)
- [ ] No date restrictions on the role

## 3. Authentication Settings
In the user record, check the **Access** tab:
- [ ] **Require Two-Factor Authentication** is UNCHECKED
- [ ] **IP Address Restriction** is blank (or includes your server's IP)
- [ ] **Login Audit Trail** doesn't show account lockouts

## 4. Permissions Check
**Go to:** Setup > Users/Roles > Manage Roles

Find the Administrator role (or the role assigned to your user) and verify these permissions:

### Setup Permissions:
- [ ] **Web Services** - Full
- [ ] **REST Web Services** - Full  
- [ ] **Login Using Access Tokens** - Full
- [ ] **Access Token Management** - Full

### Lists Permissions:
- [ ] **Customers** - Full or View
- [ ] **Transactions** - Full or View
- [ ] **Items** - Full or View

## 5. Common User Issues That Cause "token_rejected"

### Issue 1: Using System/Generic Users
- NetSuite may reject tokens from certain system users
- **Solution:** Create a dedicated API user with Administrator role

### Issue 2: User Never Logged In
- Some accounts require initial login before API access works
- **Solution:** Log in as the user at least once through the UI

### Issue 3: Password Expired
- Even for token auth, underlying user password expiry can cause issues
- **Solution:** Reset the user's password if it's expired

### Issue 4: User is Employee Record
- Employee records sometimes have different permissions
- **Solution:** Use a non-employee user or create a dedicated API user

## 6. Try a Different User

To test if it's a user-specific issue:

1. **Create a New API User:**
   - Go to: Setup > Users/Roles > Manage Users > New
   - Name: "API Integration User" 
   - Email: Use a valid email
   - Role: Administrator
   - Access: Full
   - Give the user a password

2. **Log in as the new user once** (important!)

3. **Create new Access Token with this user:**
   - Go to: Setup > Users/Roles > Access Tokens > New
   - Select your integration
   - Select the new API user
   - Select Administrator role
   - Save and copy credentials

4. **Update your secrets with the new token**

## 7. Alternative Test User

You could also try using:
- The main Administrator account (if not already)
- A user with "Integration Application Administrator" role
- A user with custom role that has all Web Services permissions

## What User Are You Currently Using?

Can you tell me:
1. What type of user did you select? (Administrator, Employee, Custom role?)
2. Has this user ever logged into NetSuite through the web interface?
3. Is it the main administrator account or a different user?

This information will help narrow down if the user account is indeed the problem.