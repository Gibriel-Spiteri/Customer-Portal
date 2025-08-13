# NetSuite Enterprise Login Solution

## Problem
NetSuite blocks login attempts from external domains with the error "You have attempted to log in from an untrusted origin". AJAX/fetch requests to the login endpoint also fail because NetSuite's authentication requires traditional form submission with redirects.

## Solution Overview
We use a two-part approach:
1. **Simple HTML login form** hosted on NetSuite that does a traditional form POST
2. **Post-login redirect** mechanism to bring users back to the Replit app

## Implementation Options

### Option 1: Portlet Redirect (Recommended)
Deploy a portlet on the Customer Center home page that automatically redirects to your Replit app after login.

**Files:**
- `customer_login_simple.html` - Simple login form
- `post_login_redirect_portlet.js` - Auto-redirect portlet

**Setup:**
1. Upload `customer_login_simple.html` to NetSuite File Cabinet
2. Create and deploy the portlet script
3. Add portlet to Customer Center home page
4. Configure portlet to run for customer roles

### Option 2: Customer Center Customization
Customize the Customer Center landing page to include a redirect script.

**Steps:**
1. Go to **Setup > Company > Customer Center**
2. Edit the home page template
3. Add JavaScript redirect code

### Option 3: Suitelet SSO
Use the provided Suitelet for SSO authentication.

**Files:**
- `customer_sso_suitelet_1755102963122.js` - SSO Suitelet

**Note:** This requires customers to access a specific Suitelet URL instead of the standard login.

## How It Works

1. **User enters credentials** in the iframe on your Replit app
2. **Form posts to NetSuite** `/app/login/secure/enterpriselogin.nl`
3. **NetSuite authenticates** and creates session
4. **User lands on Customer Center** home page
5. **Portlet/Script redirects** back to Replit with customer data
6. **Replit creates session** and logs user in

## Benefits
- No CORS or "untrusted origin" errors
- Works with NetSuite's standard authentication
- Maintains NetSuite session for API calls
- Simple and reliable

## Configuration

### Update URLs
In all scripts, update the Replit URL:
```javascript
const replitUrl = 'https://YOUR-APP.replit.app';
```

### NetSuite Deployment
1. **Portlet Script:**
   - Script ID: `customscript_login_redirect`
   - Deploy ID: `customdeploy_login_redirect`
   - Execute As Role: Current Role
   - Audience: Customer Center

2. **HTML File:**
   - Location: `/SuiteBundles/Bundle 63418/customer_login_simple.html`
   - Available Without Login: No

## Testing
1. Clear browser cookies
2. Go to your Replit app login page
3. Click Enterprise tab
4. Enter NetSuite customer credentials
5. Verify redirect back to Replit dashboard

## Troubleshooting

### No redirect after login
- Check portlet is deployed and active
- Verify Customer Center customization
- Check browser console for errors

### Customer data missing
- Ensure customer record has proper fields
- Check user has entity association
- Verify permissions

### Login fails
- Confirm credentials are correct
- Check customer has web access enabled
- Verify Customer Center role assigned