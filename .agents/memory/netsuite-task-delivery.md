---
name: NetSuite task creation quirks
description: What's required to create tasks via NetSuite REST in this account, and how to notify/email people from the portal.
---

**Rule:** Tasks created via `POST /services/rest/record/v1/task` in this account REQUIRE the custom field `custevent_crm_recordtype` ("Task Type", values in `customrecord_crm_recordtypes` — note plural in REST URL). 38 = "RFQ Activity". `assigned` needs the employee INTERNAL id (not entityid). `sendEmail: true` makes NetSuite email the assignee — this is the portal's only way to email arbitrary employees.

**Why:** The email RESTlet (`netsuite-email.ts`) only supports fixed types (`password_reset`, `welcome`) and no attachments; it's a NetSuite-side script we can't modify. File attachments can't go through REST either — the portal serves files itself via tokenized links included in the task message.

**How to apply:** Any new "notify a salesperson/employee" feature should create a task with sendEmail rather than trying to send email directly. Wrap the fetch in `nsLimit(..., 'record')`.
