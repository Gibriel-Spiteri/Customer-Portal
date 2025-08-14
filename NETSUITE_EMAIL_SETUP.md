# NetSuite Email Service RESTlet Setup

This guide explains how to deploy and configure the Email Service RESTlet in NetSuite for sending password reset and welcome emails.

## Prerequisites

- NetSuite Administrator access
- M2M OAuth2 authentication already configured (see NETSUITE_M2M_SETUP.md)

## Step 1: Upload the Script File

1. Go to **Customization > Scripting > Scripts > New**
2. Click **Upload File**
3. Upload `netsuite_scripts/email_service_restlet.js`
4. Click **Create Script Record**

## Step 2: Configure the Script Record

1. **Basic Information:**
   - Name: `Customer Portal Email Service`
   - ID: `customscript_email_service` (or note the auto-generated ID)
   - Description: `RESTlet for sending customer portal emails`

2. **Script Type:** RESTlet (should be auto-selected)

3. **Functions:**
   - POST Function: `doPost`

4. **Parameters (Optional):**
   You can add a script parameter for the email author:
   - Label: `Email Author ID`
   - ID: `custscript_email_author_id`
   - Type: Integer
   - Default Value: `-5` (system)
   - Help: `Internal ID of the employee to use as email sender`

5. Click **Save**

## Step 3: Deploy the Script

1. On the script record, click **Deploy Script**
2. Configure the deployment:
   - Title: `Customer Portal Email Service Deployment`
   - ID: `customdeploy_email_service` (or note the auto-generated ID)
   - Status: **Released**
   - Log Level: **Debug** (for testing, change to **Error** in production)
   - Execute As Role: **Administrator** (or a custom role with email permissions)
   - Authentication: **OAUTH2.0**

3. **Audience:**
   - Available Without Login: **No**
   - Roles: Select roles that should have access (typically Administrator)
   - All Employees: Can leave unchecked

4. Click **Save**

## Step 4: Note the Deployment URLs

After deployment, NetSuite will provide the RESTlet URL. It will look like:
```
https://[ACCOUNT_ID].suitetalk.api.netsuite.com/services/rest/record/v1/script/customscript_email_service/deployment/customdeploy_email_service
```

## Step 5: Configure Environment Variables

Add these environment variables to your application:

```bash
# These should already be set from M2M setup
NETSUITE_ACCOUNT_ID=1212804
NETSUITE_CONSUMER_KEY=your_consumer_key
NETSUITE_CONSUMER_SECRET=your_consumer_secret
NETSUITE_CERTIFICATE_ID=your_certificate_id

# Add these for the email service (use your actual IDs from steps 2 & 3)
NETSUITE_EMAIL_SCRIPT_ID=customscript_email_service
NETSUITE_EMAIL_DEPLOY_ID=customdeploy_email_service
```

## Step 6: Test the Email Service

1. Create a test account or request a password reset
2. Check the NetSuite script execution logs:
   - Go to **Customization > Scripting > Script Deployments**
   - Find your deployment
   - Click **View Execution Log**

## Email Templates

The RESTlet includes HTML email templates for:

### Password Reset Email
- Professional gradient header
- Clear reset instructions
- Prominent reset button
- Security notice about 1-hour expiration
- Responsive design

### Welcome Email
- Welcoming design
- Customer ID and email confirmation
- Feature list
- Login button
- Support information

## Customization

You can customize the email templates by editing the HTML in the RESTlet:
- Modify colors, fonts, and styling in the `<style>` section
- Update company branding and logos
- Change email content and messaging
- Add additional fields or information

## Troubleshooting

### Emails Not Sending
1. Check NetSuite execution logs for errors
2. Verify M2M authentication is working
3. Ensure the recipient email is valid
4. Check that the deployment status is "Released"

### Authentication Errors
1. Verify OAuth2.0 is selected in deployment
2. Check M2M credentials are correct
3. Ensure the certificate hasn't expired

### Script Errors
1. Check execution logs for specific error messages
2. Verify customer IDs are valid
3. Ensure email author ID has send permissions

## Security Considerations

1. The RESTlet validates input and logs all email sends
2. Customer IDs are linked to emails when available
3. Email content is sanitized to prevent injection
4. Authentication required via OAuth2.0
5. No sensitive data is logged

## Additional Notes

- Emails are sent from NetSuite's email servers
- NetSuite tracks email history on customer records
- Rate limits apply based on your NetSuite subscription
- Consider implementing email queuing for high volume