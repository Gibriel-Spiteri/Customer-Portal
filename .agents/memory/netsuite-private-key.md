---
name: NetSuite M2M private key handling
description: Why login can break after env reconciliation and how the PEM must be normalized
---

# NetSuite M2M private key

The M2M certificate-based OAuth2 (PS256) needs an RSA private key. It is read in
`server/services/netsuite-m2m.ts` constructor: `NETSUITE_PRIVATE_KEY` env var first,
then a fallback file `netsuite_private_key.pem`.

## Rule: the key must live in the NETSUITE_PRIVATE_KEY secret, not only the file
**Why:** `netsuite_private_key.pem` is gitignored/untracked, so it is NOT restored
during environment reconciliation after a task merge — it gets wiped and login starts
returning 500 "Authentication service temporarily unavailable" (the login route
catch-all). The other NetSuite creds (consumer key/secret, certificate id, account id)
are already secrets and survive; only the key file was lost.
**How to apply:** if login fails with "Private key file not found" or "requires a
private key", check `viewEnvVars({type:'secret', keys:['NETSUITE_PRIVATE_KEY']})` and
request the secret from the user rather than recreating a file.

## Rule: always normalize the PEM before use
**Why:** a PEM pasted into a secret loses its line breaks (Replit stored it as a single
line with no newlines at all), so `jwt.sign(..., {algorithm:'PS256'})` /
`crypto.createPrivateKey()` throw `secretOrPrivateKey must be an asymmetric key when
using PS256` or `DECODER routines::unsupported`.
**How to apply:** `normalizePrivateKey()` strips `\n` escapes, extracts the
BEGIN/END marker type + base64 body, and re-wraps the body at 64 chars with real
newlines. Applied to both the env-var and file code paths. Don't remove it.
