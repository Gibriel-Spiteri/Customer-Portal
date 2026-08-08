---
name: Twilio connector & contact-update quirks
description: How Twilio Lookup creds are obtained, NetSuite SuiteQL/REST limitations hit by the account contact-update feature.
---

**Twilio creds:** The Replit Twilio connector's proxy only reaches api.twilio.com — lookups.twilio.com is NOT proxied. Fetch creds app-side via `GET {connectors base}/api/v2/connection?connector_names=twilio&include_secrets=true` with `buildHeaders()` from `@replit/connectors-sdk/identity.js` (settings: account_sid/api_key/api_key_secret), then call Lookup v2 with Basic auth. Fetch fresh per call; never cache.

**SuiteQL:** `customer.defaultaddress` is NOT exposed to SuiteQL (NOT_EXPOSED). Get the default address via `customerAddressbook cab JOIN customerAddressbookEntityAddress a ON cab.addressbookaddress = a.nkey WHERE cab.defaultshipping = 'T'` (column `a.addrtext`).

**Address writes:** Update the existing default addressBook line via `PATCH /record/v1/customer/{id}/addressBook/{lineId}` (lineId from the item's self link). Fail closed if the addressBook GET errors — treating it as empty creates duplicate defaults.

**Email verification codes:** sent through the NetSuite email RESTlet's `verification_code` type — this type must exist in the DEPLOYED RESTlet (source: `netsuite_scripts/email_service_restlet.js`); if the deployed script is older, sends fail gracefully with 502. Codes in-memory only (fine: autoscale max machines = 1).
