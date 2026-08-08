import { NetSuiteM2M } from '../server/services/netsuite-m2m';
(async () => {
  const m2m = new NetSuiteM2M();
  try {
    const q = await m2m.executeSuiteQL(`SELECT custentity_webstorepassword FROM contact WHERE id = 2366832`, 1, 0);
    console.log('CONTACT-WEBSTORE:', JSON.stringify(q.items));
  } catch (e: any) { console.log('C1ERR', e.message.slice(0, 300)); }
  const token = await (m2m as any).getAccessToken();
  const base = (m2m as any).apiBaseUrl;
  const r = await fetch(`${base}/record/v1/contact/2366832`, { headers: { Authorization: `Bearer ${token}` } });
  const d: any = await r.json();
  console.log('CONTACT KEYS:', JSON.stringify(Object.keys(d).filter(k => /custentity|pass|pwd/i.test(k))));
})().then(()=>process.exit(0)).catch(e=>{console.log('ERR',e.message);process.exit(1);});
