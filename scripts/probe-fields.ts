import { NetSuiteM2M } from '../server/services/netsuite-m2m';
(async () => {
  const m2m = new NetSuiteM2M();
  try {
    const r = await m2m.executeSuiteQL(`SELECT scriptid, name FROM customfield WHERE LOWER(name) LIKE '%password%' OR LOWER(name) LIKE '%dealer%' OR LOWER(name) LIKE '%pw%'`, 50, 0);
    console.log('FIELDS:', JSON.stringify(r.items?.map((i: any) => ({ scriptid: i.scriptid, name: i.name }))));
  } catch (e: any) { console.log('QERR', e.message); }
  const q = await m2m.executeSuiteQL(`SELECT custentity_legpw FROM customer WHERE id = 155425`, 1, 0);
  console.log('legpw value:', JSON.stringify(q.items));
})().then(()=>process.exit(0)).catch(e=>{console.log('ERR',e.message);process.exit(1);});
