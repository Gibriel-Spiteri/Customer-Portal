import { NetSuiteM2M } from '../server/services/netsuite-m2m';
(async () => {
  const m2m = new NetSuiteM2M();
  const token = await (m2m as any).getAccessToken();
  const base = (m2m as any).apiBaseUrl;
  const r = await fetch(`${base}/record/v1/customer/155425`, { headers: { Authorization: `Bearer ${token}` } });
  const d: any = await r.json();
  console.log('custom fields:', JSON.stringify(Object.keys(d).filter(k => k.startsWith('custentity'))));
  console.log('pw-ish keys:', JSON.stringify(Object.keys(d).filter(k => /pass|pwd|dealer|access|login/i.test(k))));
  for (const k of Object.keys(d)) {
    if (/pass|dealer/i.test(k)) console.log(k, '=', JSON.stringify(d[k]).slice(0, 120));
  }
})().then(()=>process.exit(0)).catch(e=>{console.log('ERR',e.message);process.exit(1);});
