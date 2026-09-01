import { NetSuiteM2M } from '../server/services/netsuite-m2m';
(async()=>{const m=new NetSuiteM2M();for(const q of [
`SELECT systemnote.field, systemnote.oldvalue, systemnote.newvalue, systemnote.date FROM systemnote WHERE systemnote.recordid = 2039082 ORDER BY systemnote.date`,
`SELECT supportcase.id, supportcase.subsidiary, BUILTIN.DF(supportcase.subsidiary) AS subsidiaryname FROM supportcase WHERE supportcase.id = 2039082`
]){try{const r=await m.executeSuiteQL(q,100,0);console.log('RESULT',JSON.stringify(r.items));}catch(e:any){console.log('ERR',e.message)}}})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
