# NetSuite Enterprise Login Setup Guide

## Overview
This document explains how to set up the NetSuite Enterprise login with proper redirect back to the Replit application after successful authentication.

## Components

### 1. NetSuite-Hosted Login HTML
The login form must be hosted on NetSuite's domain to avoid "untrusted origin" errors.

**File Location:** `/c.1212804/suitebundle63418/customer_login_redirect.html`

This HTML file:
- Contains a Bootstrap-styled login form
- Posts directly to NetSuite's `/app/login/secure/enterpriselogin.nl`
- Uses JavaScript to intercept the login and redirect back to Replit
- Passes customer data (ID, name, email) back to the application

### 2. Customer Data RESTlet
A NetSuite RESTlet that returns the current logged-in customer's information.

**Script:** `customer_data_restlet.js`
- Script ID: `customscript_customer_data`
- Deploy ID: `customdeploy_customer_data`
- Returns customer ID, name, email, and other details

### 3. Enterprise Callback Route
The Replit application handles the redirect with customer data.

**Route:** `/auth/netsuite/enterprise-callback`
- Receives customer ID, name, and email as query parameters
- Creates or updates user in local database
- Generates JWT token
- Sets session
- Redirects to dashboard

## Setup Instructions

### Step 1: Upload Login HTML to NetSuite
1. Go to **Documents > Files > File Cabinet** in NetSuite
2. Navigate to **SuiteBundles > Bundle 63418**
3. Upload `customer_login_redirect.html`
4. Note the file URL

### Step 2: Deploy Customer Data RESTlet
1. Go to **Customization > Scripting > Scripts > New**
2. Upload `customer_data_restlet.js`
3. Create script record:
   - Name: Customer Data RESTlet
   - ID: `customscript_customer_data`
4. Deploy the script:
   - Deploy ID: `customdeploy_customer_data`
   - Status: Released
   - Audience: All Roles

### Step 3: Update Application
1. Update the iframe URL in the Enterprise tab to point to your hosted HTML
2. Ensure the callback route is implemented in `server/routes.ts`

## How It Works

1. User clicks Enterprise tab in login page
2. Iframe loads NetSuite-hosted login form
3. User enters credentials
4. JavaScript intercepts form submission
5. Credentials are validated by NetSuite
6. On success, RESTlet fetches customer data
7. Page redirects to Replit with customer info
8. Replit creates session and redirects to dashboard

## Security Notes
- Credentials are only sent to NetSuite, never to Replit
- Customer data is fetched using NetSuite session cookies
- JWT tokens are generated after successful NetSuite authentication
- No passwords are stored in the Replit database for NetSuite users

## Troubleshooting

### "Untrusted Origin" Error
- Ensure the login HTML is hosted on NetSuite's domain
- Check that the iframe sandbox attributes include `allow-same-origin`

### Redirect Not Working
- Verify the RESTlet is deployed and accessible
- Check browser console for JavaScript errors
- Ensure the redirect URL is correct in the HTML

### Customer Data Not Loading
- Confirm the RESTlet script and deploy IDs match
- Check that the user has proper permissions to access the RESTlet
- Verify the NetSuite session is active