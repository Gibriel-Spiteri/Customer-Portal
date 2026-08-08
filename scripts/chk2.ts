import { NetSuiteM2M } from '../server/services/netsuite-m2m';
(async () => {
  const m2m = new NetSuiteM2M();
  const token = await (m2m as any).getAccessToken();
  const base = (m2m as any).apiBaseUrl;
  // Full field dump of Phil's contact
  let r = await fetch(`${base}/record/v1/contact/2366832`, { headers: { Authorization: `Bearer ${token}` } });
  const d: any = await r.json();
  const interesting: any = {};
  for (const k of Object.keys(d)) if (/pass|pwd|pin|legpw|webstore/i.test(k)) interesting[k] = d[k];
  console.log('PHIL FIELDS:', JSON.stringify(interesting));
  // Does contact accept webstorepassword / legpw?
  for (const f of ['custentity_webstorepassword', 'custentity_legpw']) {
    r = await fetch(`${base}/record/v1/contact/2366832`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [f]: 'probe789' }) });
    const ok = r.ok;
    let readback = '';
    if (ok) {
      const g = await fetch(`${base}/record/v1/contact/2366832?fields=${f}`, { headers: { Authorization: `Bearer ${token}` } });
      const gd: any = await g.json();
      readback = gd[f];
      // revert probe if it stuck
      if (readback === 'probe789') {
        await fetch(`${base}/record/v1/contact/2366832`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ [f]: 'jennifer' }) });
      }
    }
    console.log('PROBE', f, r.status, 'readback:', JSON.stringify(readback));
  }
})().then(()=>process.exit(0)).catch(e=>{console.log('ERR',e.message);process.exit(1);});
