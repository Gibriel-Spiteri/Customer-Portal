import { NetSuiteM2M } from '../server/services/netsuite-m2m';
(async () => {
  const m2m = new NetSuiteM2M();
  try {
    const q = await m2m.executeSuiteQL(`SELECT custentity_webstorepassword, custentity_legpw FROM customer WHERE id = 155425`, 1, 0);
    console.log('VALUES:', JSON.stringify(q.items));
  } catch (e: any) { console.log('QERR', e.message); }
})().then(()=>process.exit(0)).catch(e=>{console.log('ERR',e.message);process.exit(1);});
