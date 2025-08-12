# NetSuite M2M Setup Verification Checklist

## Certificate Fingerprints
Your certificate has these fingerprints (useful for verification in NetSuite):
- SHA256: (will be shown in terminal output)
- SHA1: (will be shown in terminal output)

## Critical Verification Steps

### 1. Certificate Upload Verification
In NetSuite, go to **Setup → Integration → Manage Integrations → [Your Integration]**

Please verify:
- [ ] The certificate shows as "Valid" or "Active"
- [ ] The Certificate ID shown is exactly: `YmPJCW5cqaLXXL85kNfuFswDtic5XcNYhwgbB7WpLrU`
- [ ] The certificate was uploaded from the file `netsuite_certificate.pem` we generated

### 2. OAuth 2.0 Settings (CRITICAL)
In the same integration record, verify these OAuth 2.0 settings:

**OAuth 2.0 Section:**
- [ ] OAuth 2.0: **ENABLED** ✓
- [ ] Grant Type: **Client Credentials** is CHECKED ✓ (This is crucial!)
- [ ] Scope: **rest_webservices** is included ✓

### 3. Consumer Key/Secret Verification
- [ ] Consumer Key matches: `4b3c88a85bdd1459e1c04434dba56fd92f96184c1a87655846e8f4b0b925341d`
- [ ] Consumer Secret is set (you have this in your secrets)

### 4. Common Issues That Cause "invalid_grant"

1. **Certificate Mismatch**: The certificate in NetSuite doesn't match the private key we're using
   - Solution: Re-upload the certificate from `netsuite_certificate.pem`

2. **Grant Type Not Enabled**: "Client Credentials" not checked in OAuth 2.0 settings
   - Solution: Enable "Client Credentials" grant type

3. **Certificate ID Mismatch**: Using wrong Certificate ID
   - Solution: Copy the exact Certificate ID from NetSuite after upload

4. **Time Sync Issue**: Server time is off
   - Current server time: (checking...)

## Alternative Test
If the above checks pass but it still doesn't work, try:

1. **Delete and Re-create the Integration**:
   - Delete the current integration
   - Create a new one with OAuth 2.0 and Client Credentials enabled
   - Upload the certificate
   - Get new Consumer Key/Secret and Certificate ID

2. **Try in a Different Browser/Incognito**:
   - Sometimes NetSuite caches old settings

## Debug Information
Based on our testing:
- JWT generation: ✅ Working correctly
- JWT signature: ✅ Valid with our certificate
- Request format: ✅ Correct OAuth 2.0 format
- NetSuite response: ❌ "invalid_grant" error

This strongly suggests a configuration mismatch in NetSuite, most likely:
- The certificate uploaded doesn't match our private key
- Or "Client Credentials" grant type is not enabled