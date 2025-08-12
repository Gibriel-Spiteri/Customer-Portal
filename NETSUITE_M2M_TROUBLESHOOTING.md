# NetSuite M2M OAuth Troubleshooting Guide

## Current Status
- ✅ Private key loaded successfully
- ✅ JWT generation working
- ✅ Certificate ID configured: `YmPJCW5cqaLXXL85kNfuFswDtic5XcNYhwgbB7WpLrU`
- ✅ Consumer Key configured: `4b3c88a85bdd1459e1c04434dba56fd92f96184c1a87655846e8f4b0b925341d`
- ✅ Account ID extracted: `1212804`
- ❌ Getting "invalid_grant" error from NetSuite

## Please Verify in NetSuite

### 1. Integration Record Settings
Go to **Setup → Integration → Manage Integrations** and verify your integration has:

- [ ] **OAuth 2.0** section:
  - OAuth 2.0 is **ENABLED**
  - Grant Type includes **CLIENT CREDENTIALS**
  - Scopes include **REST WEB SERVICES**

- [ ] **Authentication** section:
  - User Credentials: **NOT REQUIRED**
  - TBA (Token-Based Auth): **NOT REQUIRED**

- [ ] **Certificate** section:
  - Certificate is uploaded (should show the certificate you uploaded)
  - Certificate ID matches: `YmPJCW5cqaLXXL85kNfuFswDtic5XcNYhwgbB7WpLrU`

### 2. Consumer Key/Secret
Verify the Consumer Key and Secret match what's in your environment:
- Consumer Key should be: `4b3c88a85bdd1459e1c04434dba56fd92f96184c1a87655846e8f4b0b925341d`
- Consumer Secret should match what you have in NETSUITE_CONSUMER_SECRET

### 3. Certificate Upload Verification
The certificate you uploaded should:
- Be the 4096-bit RSA certificate we generated
- Show as "Active" or "Valid" in NetSuite
- Have the Certificate ID that NetSuite generated after upload

### 4. Common Issues and Solutions

#### Issue: Certificate ID Mismatch
**Solution**: After uploading the certificate, NetSuite generates its own Certificate ID. Make sure you're using NetSuite's generated ID, not any other value.

#### Issue: Wrong Grant Type
**Solution**: Ensure "Client Credentials" is selected in the OAuth 2.0 grant types.

#### Issue: Missing Scopes
**Solution**: Add "rest_webservices" scope to the integration.

#### Issue: Integration Not Saved
**Solution**: After making changes, click "Save" on the integration record.

## Next Steps

1. **Check the Integration Record** in NetSuite using the checklist above
2. **Update the Certificate ID** if it's different from what NetSuite shows
3. **Verify all OAuth 2.0 settings** are enabled and configured
4. **Test again** after verification

## Need to Update Credentials?

If you need to update any credentials after verification:
- Update NETSUITE_CERTIFICATE_ID with the correct ID from NetSuite
- Ensure NETSUITE_CONSUMER_KEY matches exactly
- Ensure NETSUITE_CONSUMER_SECRET matches exactly

Let me know what you find in the NetSuite integration settings!