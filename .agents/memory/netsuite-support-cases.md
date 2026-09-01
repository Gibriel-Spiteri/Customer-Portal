---
name: NetSuite portal support cases
description: Required routing and custom-form behavior for Customer Service cases created by the customer portal.
---

**Rule:** Portal-created support cases must leave `assigned` unset so NetSuite's default Customer Service routing chooses the owner. The `.JRP/OPR` case form treats the standard company field as "Case Created By" and expects an employee, while the customer belongs in the dedicated customer field. Use the shared Consumers mailbox employee as the creator and AFTER SALE SERVICE as the Department.

**Why:** Non-saving REST validation showed that `.JRP/OPR` rejects new cases unless Department is populated, but the integration role's Support Case schema did not expose that mandatory field. Supplying standard and likely custom field IDs was ignored. This is a NetSuite role/form-access constraint, not an assignee requirement.

**How to apply:** Ensure the M2M integration role can see and set the case Department field and that it defaults to AFTER SALE SERVICE. Re-run a transient validation before creating a real case. Do not put the customer in the standard company field and do not hard-code `assigned`.