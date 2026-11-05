import {readFile} from 'node:fs/promises';
const [action='help',file]=process.argv.slice(2);
let pool;
try {
  if(action==='help') console.log('Uso: node server/jobs/installation-context.mjs plan|capture|apply manifesto.json');
  else {
    if(!['plan','capture','apply'].includes(action)||!file) throw new Error('COMANDO_INVALIDO');
    const scope=JSON.parse(await readFile(file,'utf8'));
    const {validateInstallationContextScope,planInstallationContext,captureInstallationContext,applyInstallationContext}=await import('../installationContext.mjs');
    validateInstallationContextScope(scope);
    ({pool}=await import('../db.mjs'));
    let result;
    if(action==='plan') result=await planInstallationContext(pool,scope);
    else if(action==='apply') result=await applyInstallationContext(pool,scope);
    else {
      const {HubsoftGate}=await import('../hubsoftGate.mjs');
      const {HubsoftClient}=await import('../hubsoft.mjs');
      const client=new HubsoftClient(process.env,fetch,undefined,new HubsoftGate(pool,process.env));
      result=await captureInstallationContext(pool,client,scope);
    }
    console.log(JSON.stringify(result,null,2));
  }
} catch(error) {
  const code=String(error.code??error.message??'');
  console.error(/^[A-Z_0-9]{3,100}$/.test(code)?code:'CONTEXTO_INTERROMPIDO');
  process.exitCode=1;
} finally {if(pool)await pool.end();}
