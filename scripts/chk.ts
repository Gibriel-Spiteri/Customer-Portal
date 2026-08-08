import { NetSuiteM2M } from '../server/services/netsuite-m2m';
(async () => {
  const m2m = new NetSuiteM2M();
  const q = await m2m.executeSuiteQL(`SELECT custentity_legpw FROM customer WHERE id = 2366831`, 1, 0);
  console.log('test cust legpw:', JSON.stringify(q.items?.[0]?.custentity_legpw));
  const q2 = await m2m.executeSuiteQL(`SELECT custentity_legpw FROM customer WHERE id = 155425`, 1, 0);
  console.log('JRH legpw:', JSON.stringify(q2.items?.[0]?.custentity_legpw));
})().then(()=>process.exit(0)).catch(e=>{console.log('ERR',e.message);process.exit(1);});
