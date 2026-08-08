---
name: NetSuite built-in contact roles
description: Built-in contact roles (-10 Primary, -20 Alternate) cannot be set via REST; portal adds alternates role-less by user decision.
---

**Rule:** NetSuite REST web services cannot set the built-in contact roles (-10 Primary Contact, -20 Alternate Contact). PATCHing `customer/{id}/contactRoles/{contactId}` with `role: -20` returns "Invalid Field Value"; the contact record itself has no role field in REST. The `contactRoles.role` field in REST is the Customer Center access role (e.g. 1036), a different thing. Likely related to the customer's custom relationship form (per user).

**Why:** Discovered while building add-alternate-contact; user decided (Aug 2026) new alternate contacts go in WITHOUT a role — the SuiteScript workaround was removed. Don't re-add a role step.

**How to apply:** If a role ever becomes required again, it must be set via SuiteScript (customer record `contactroles` sublist, `role` field), which means adding a type to the email RESTlet and having the user redeploy it in NetSuite.

Also learned: `createRecord` returns the new record id from the REST `Location` response header; `storage.createUser` hashes the password itself — never pre-hash before calling it (double-hash breaks login).
