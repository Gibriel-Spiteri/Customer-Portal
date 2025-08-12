# NetSuite M2M Certificate Setup Guide

## Overview
NetSuite OAuth 2.0 Machine-to-Machine (M2M) authentication requires certificate-based authentication. This guide explains how to upload the certificate to NetSuite and configure your integration.

## Certificate Generation (Already Completed)
The following certificate and private key have been generated for your portal:

- **Certificate File**: `netsuite_certificate.pem`
- **Private Key File**: `netsuite_private_key.pem`
- **Key Type**: RSA 4096-bit (NetSuite requirement)
- **Validity**: 365 days

## Step 1: Upload Certificate to NetSuite

1. **Navigate to Integration Record**
   - In NetSuite, go to **Setup → Integration → Manage Integrations**
   - Find your integration record (or create a new one if needed)
   - Click **Edit**

2. **Upload the Certificate**
   - In the **Authentication** section, ensure **OAuth 2.0** is enabled
   - Under **OAuth 2.0 Settings**, check **Client Credentials (M2M) Grant**
   - In the **Certificate** section, click **Choose File**
   - Upload the `netsuite_certificate.pem` file from this project
   - NetSuite will automatically generate a **Certificate ID** after upload

3. **Note the Certificate ID**
   - After uploading, NetSuite will display a **Certificate ID** (e.g., `cert_abc123`)
   - Copy this Certificate ID - you'll need it for the next step

## Step 2: Configure Environment Variables

Add the Certificate ID to your Replit Secrets:

1. **In Replit**, click the lock icon (Secrets)
2. Add a new secret:
   - **Key**: `NETSUITE_CERTIFICATE_ID`
   - **Value**: The Certificate ID from NetSuite (e.g., `cert_abc123`)

## Step 3: Verify Your Configuration

Your portal should now have all required M2M credentials:
- ✅ **NETSUITE_CONSUMER_KEY** (from integration record)
- ✅ **NETSUITE_CONSUMER_SECRET** (from integration record)
- ✅ **NETSUITE_CERTIFICATE_ID** (from certificate upload)
- ✅ **Private Key** (stored in `netsuite_private_key.pem`)

## Step 4: Grant Permissions

Ensure your integration has the necessary permissions:

1. **In the Integration Record**:
   - Under **Roles**, add the appropriate roles that have access to:
     - REST Web Services
     - SuiteQL queries
     - Customer records
     - Transaction records (estimates, orders, invoices)

2. **Recommended Permissions**:
   - **REST Web Services** - Full
   - **Lists → Customers** - View
   - **Transactions → Estimate** - View
   - **Transactions → Sales Order** - View
   - **Transactions → Invoice** - View
   - **Transactions → Customer Payment** - View

## Step 5: Test the Connection

After configuration, the portal will automatically test the M2M connection when fetching data. You can verify it's working by:

1. Logging into the customer portal
2. Navigating to the dashboard
3. Checking if estimates and other data load successfully

## Troubleshooting

### Certificate Upload Issues
- Ensure the certificate is in PEM format
- The certificate should include the `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` markers
- Only upload the certificate, not the private key

### Authentication Failures
- Verify the Certificate ID matches exactly what NetSuite shows
- Ensure the integration has OAuth 2.0 Client Credentials enabled
- Check that the consumer key and secret are correct
- Verify the account ID is correct (format: `1234567` or `1234567_SB1`)

### Permission Errors
- Ensure the integration has appropriate role permissions
- The role must have REST Web Services permission
- Check that SuiteQL queries are enabled for the role

## Security Notes

⚠️ **Important Security Considerations**:
- **Never share or commit the private key** to version control
- The private key file (`netsuite_private_key.pem`) is kept locally only
- Keep your consumer secret and certificate ID secure
- Rotate certificates periodically (recommended annually)

## Certificate Renewal

When the certificate expires (after 365 days):
1. Generate a new certificate and private key
2. Upload the new certificate to NetSuite
3. Update the Certificate ID in Replit Secrets
4. Replace the `netsuite_private_key.pem` file

## Related Documentation
- [NetSuite M2M Setup Guide](./NETSUITE_M2M_SETUP.md)
- [NetSuite OAuth Setup Guide](./NETSUITE_OAUTH_SETUP.md)
- [NetSuite Customer Center SAML Setup](./NETSUITE_CUSTOMER_CENTER_SAML_SETUP.md)