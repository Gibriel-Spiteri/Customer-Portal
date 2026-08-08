---
name: NetSuite built-in contact roles
description: Built-in contact roles (-10 Primary, -20 Alternate) cannot be set via REST — only SuiteScript.
---

**Rule:** NetSuite REST web services cannot set the built-in contact roles (-10 Primary Contact, -20 Alternate Contact). PATCHing `customer/{id}/contactRoles/{contactId}` with `role: -20` returns "Invalid Field Value"; the contact record itself has no role field in REST. The `contactRoles.role` field in REST is the Customer Center access role (e.g. 1036), a different thing entirely.

**Why:** Discovered while building add-alternate-contact: contacts created via REST show a blank role in SuiteQL `contact.contactrole`.

**How to apply:** Set the role through SuiteScript — the portal's email RESTlet has a `set_contact_role` type (loads the customer, updates the `contactroles` sublist `role` field). The RESTlet must be redeployed in NetSuite after the source in `netsuite_scripts/` changes; until then the server returns a `roleWarning` and the contact stays role-less.

Also learned: `createRecord` returns the new record id from the REST `Location` response header; `storage.createUser` hashes the password itself — never pre-hash before calling it (double-hash breaks login).
