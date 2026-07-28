import fetch from 'node-fetch';
import { NetSuiteM2M } from './netsuite-m2m';
import { nsLimit } from './ns-limit';

/**
 * Quick Quote service.
 *
 * - Lists salespeople grouped by store (NetSuite employees with the Sales Rep
 *   flag, restricted to the real retail locations below).
 * - Creates the NetSuite task that delivers a quote request to the selected
 *   salesperson (assigned + sendEmail=true, logged on the customer record).
 */

// The retail stores shown in the Quick Quote store picker. Other NetSuite
// locations (Corporate, TEST LOCATION, Yaphank warehouse, etc.) are excluded.
export const QUICK_QUOTE_STORES = [
  'East Meadow',
  'Commack',
  'Patchogue',
  'Copiague',
  'Franklin Square',
] as const;

// "Task Type" (custevent_crm_recordtype) is mandatory on tasks in this account.
// 38 = "RFQ Activity" (request-for-quote), the closest fit for a quote request.
const TASK_TYPE_ID = process.env.QUICK_QUOTE_TASK_TYPE_ID || '38';

export interface SalesRep {
  id: string; // NetSuite employee internal id
  name: string;
  email: string | null;
}

export interface StoreWithReps {
  store: string;
  salespeople: SalesRep[];
}

// Salespeople change rarely; cache for 10 minutes to conserve the shared
// 2-slot NetSuite concurrency budget. Per-process cache is fine (max 1 machine).
const CACHE_TTL_MS = 10 * 60 * 1000;
let repsCache: { data: StoreWithReps[]; fetchedAt: number } | null = null;

export async function getSalespeopleByStore(): Promise<StoreWithReps[]> {
  if (repsCache && Date.now() - repsCache.fetchedAt < CACHE_TTL_MS) {
    return repsCache.data;
  }

  const m2m = new NetSuiteM2M();
  const storeList = QUICK_QUOTE_STORES.map((s) => `'${s}'`).join(', ');
  const query = `
    SELECT
      employee.id,
      employee.firstname,
      employee.lastname,
      employee.custentity_preferred_name AS preferredname,
      employee.email,
      BUILTIN.DF(employee.location) AS location
    FROM employee
    WHERE employee.isinactive = 'F'
      AND employee.issalesrep = 'T'
      AND employee.releasedate IS NULL
      AND BUILTIN.DF(employee.location) IN (${storeList})
    ORDER BY employee.lastname, employee.firstname
  `;
  const result = await m2m.executeSuiteQL(query, 200, 0);

  const byStore = new Map<string, SalesRep[]>();
  for (const store of QUICK_QUOTE_STORES) byStore.set(store, []);
  for (const row of result.items || []) {
    const store = row.location as string;
    if (!byStore.has(store)) continue;
    const name =
      (row.preferredname as string) ||
      [row.firstname, row.lastname].filter(Boolean).join(' ') ||
      'Unknown';
    byStore.get(store)!.push({
      id: String(row.id),
      name,
      email: (row.email as string) || null,
    });
  }

  const data: StoreWithReps[] = QUICK_QUOTE_STORES.map((store) => ({
    store,
    salespeople: byStore.get(store)!,
  }));
  repsCache = { data, fetchedAt: Date.now() };
  return data;
}

// The shared "Consumers Kitchens" employee record (info@consumersmail.com).
// Every form submission is copied here via a sendEmail task.
export const INFO_MAILBOX_EMPLOYEE_ID = process.env.INFO_MAILBOX_EMPLOYEE_ID || '271683';

// Store managers change rarely; cache alongside the reps list.
let managersCache: { data: Map<string, SalesRep>; fetchedAt: number } | null = null;

/**
 * Look up the store manager for a location. Prefers title "STORE MANAGER";
 * Franklin Square has none, so any "<x> MANAGER" title (e.g. Sales Manager)
 * is the fallback. Returns null if the store has no manager in NetSuite.
 */
export async function getStoreManager(storeName: string): Promise<SalesRep | null> {
  if (!managersCache || Date.now() - managersCache.fetchedAt >= CACHE_TTL_MS) {
    const m2m = new NetSuiteM2M();
    const storeList = QUICK_QUOTE_STORES.map((s) => `'${s}'`).join(', ');
    const query = `
      SELECT
        employee.id,
        employee.firstname,
        employee.lastname,
        employee.email,
        employee.title,
        BUILTIN.DF(employee.location) AS location
      FROM employee
      WHERE employee.isinactive = 'F'
        AND employee.releasedate IS NULL
        AND BUILTIN.DF(employee.location) IN (${storeList})
        AND UPPER(employee.title) LIKE '%MANAGER%'
    `;
    const result = await m2m.executeSuiteQL(query, 100, 0);
    const byStore = new Map<string, SalesRep>();
    // Deterministic preference order; within a tier, lowest internal id wins.
    const tier = (title: string) => {
      if (title === 'STORE MANAGER') return 0;
      if (title === 'SALES MANAGER') return 1;
      if (title.includes('ASSISTANT')) return 3;
      return 2; // any other manager title
    };
    const rows = (result.items || []).slice().sort((a: any, b: any) => {
      const t = tier(String(a.title || '').toUpperCase()) - tier(String(b.title || '').toUpperCase());
      return t !== 0 ? t : Number(a.id) - Number(b.id);
    });
    for (const row of rows) {
      const store = row.location as string;
      const title = String(row.title || '').toUpperCase();
      if (byStore.has(store) || title.includes('ASSISTANT')) continue;
      byStore.set(store, {
        id: String(row.id),
        name: [row.firstname, row.lastname].filter(Boolean).join(' '),
        email: (row.email as string) || null,
      });
    }
    managersCache = { data: byStore, fetchedAt: Date.now() };
  }
  return managersCache.data.get(storeName) || null;
}

/** Look up a single rep (validates the client-submitted rep belongs to the store). */
export async function findSalesRep(storeName: string, repId: string): Promise<SalesRep | null> {
  const stores = await getSalespeopleByStore();
  const store = stores.find((s) => s.store === storeName);
  return store?.salespeople.find((r) => r.id === repId) || null;
}

/** Resolve the customer's NetSuite internal id from the portal's customer identifier. */
export async function getCustomerInternalId(netsuiteCustomerId: string): Promise<string | null> {
  const m2m = new NetSuiteM2M();
  const safe = netsuiteCustomerId.replace(/'/g, "''");
  const query = `SELECT id FROM customer WHERE entityid = '${safe}' OR id = ${/^\d+$/.test(netsuiteCustomerId) ? netsuiteCustomerId : '-1'}`;
  const result = await m2m.executeSuiteQL(query, 1, 0);
  return result.items?.[0]?.id ? String(result.items[0].id) : null;
}

export interface QuickQuoteTaskParams {
  salesRepId: string;
  customerInternalId: string;
  title: string;
  message: string;
}

/**
 * Create the NetSuite task assigned to the salesperson. NetSuite emails the
 * assignee (sendEmail=true) and the task appears on the customer record.
 * Returns the created task internal id.
 */
export async function createQuickQuoteTask(params: QuickQuoteTaskParams): Promise<string> {
  const m2m = new NetSuiteM2M();
  const accessToken = await m2m.getAccessToken();
  const url = `${m2m.getApiBaseUrl()}/record/v1/task`;

  const body: any = {
    title: params.title,
    message: params.message,
    assigned: { id: params.salesRepId },
    sendEmail: true,
    priority: { id: 'HIGH' },
    custevent_crm_recordtype: { id: TASK_TYPE_ID },
    company: { id: params.customerInternalId },
  };

  const response = await nsLimit(
    () =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      }),
    'record'
  );

  if (response.status !== 204 && !response.ok) {
    const text = await response.text();
    throw new Error(`NetSuite task creation failed (${response.status}): ${text.slice(0, 500)}`);
  }

  const location = response.headers.get('location') || '';
  const taskId = location.split('/').pop() || '';
  if (!taskId) {
    throw new Error('NetSuite task created but no task id returned');
  }
  return taskId;
}
