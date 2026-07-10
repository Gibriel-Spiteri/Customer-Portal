---
name: NetSuite concurrency cap is per-process
description: The global nsLimit semaphore caps calls per Node process; autoscale multiplies it.
---

The app-wide NetSuite limiter is an in-process semaphore. Every NetSuite HTTP call must go through it, but it only bounds ONE Node process.

**Why:** The account hit its 10-concurrency governance limit (Jul 10, 2026) while the app nominally had a cap of 3 — a legacy OAuth1 service bypassed the limiter with its own 15+ local cap, and the deployment target is autoscale, where N instances = N × cap. Cap was lowered to 2 and all bypasses were wired through the limiter.

**How to apply:**
- Any new code path that calls NetSuite (fetch, SDK, RESTlet, token endpoint) must go through the global limiter — grep for raw `fetch(` against netsuite domains when adding services.
- A true account-wide cap of 2 requires the deployment's max machine count set to 1; a running dev workspace adds its own 2 on top of production.
- Other integrations (e.g. Appointment Scheduling) share the same NetSuite account pool and are outside this app's control.
