import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {validateAutomaticConfig} from '../automaticPolicy.mjs';
const [action='help',file]=process.argv.slice(2);
let pool;
try {
  if(action==='help') console.log('Uso: automatic-sync.mjs plan|configure config.json; status|enable|pause|resume|run');
  else if(action==='plan') console.log(JSON.stringify({config:validateAutomaticConfig(JSON.parse(await readFile(file,'utf8'))),enabled:false,externalReportRequired:false},null,2));
  else if(!['configure','status','enable','pause','resume','run'].includes(action)) throw new Error('COMANDO_INVALIDO');
  else {
    ({pool}=await import('../db.mjs'));
    const {configureAutomaticSync,automaticStatus,controlAutomaticSync,automaticTick,assertAutomaticEnabled}=await import('../automaticSync.mjs');
    if(action==='configure') console.log(JSON.stringify(await configureAutomaticSync(pool,JSON.parse(await readFile(file,'utf8'))),null,2));
    else if(action==='status') console.log(JSON.stringify(await automaticStatus(pool),null,2));
    else if(action!=='run') console.log(JSON.stringify(await controlAutomaticSync(pool,action,process.env),null,2));
    else {
      assertAutomaticEnabled(process.env);
      const {HubsoftClient}=await import('../hubsoft.mjs');
      const {HubsoftGate}=await import('../hubsoftGate.mjs');
      const client=new HubsoftClient(process.env,fetch,undefined,new HubsoftGate(pool,process.env));
      let stop=false,lastLog=0,lastState='';const abort=new AbortController();
      for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>{stop=true;abort.abort();});
      while(!stop) {
        let status;
        try {status=await automaticTick(pool,client,process.env);}
        catch(error){
          if(['SINCRONIZACAO_EM_ANDAMENTO','HUBSOFT_FILA_OCUPADA'].includes(error.code)) status={busy:true};
          else throw error;
        }
        const state=JSON.stringify([status.enabled,status.active_job,status.error_code,status.job?.state,status.job?.month_index]);
        if(state!==lastState||Date.now()-lastLog>=30000){console.log(JSON.stringify(status));lastLog=Date.now();lastState=state;}
        const active=status.enabled&&!status.error_code&&status.job?.state==='running';
        const wait=active?Math.min(15000,Math.max(1000,new Date(status.job.next_at).getTime()-Date.now())):15000;
        try{await delay(wait,undefined,{signal:abort.signal});}catch(error){if(!stop)throw error;}
      }
    }
  }
}catch(error){
  const code=error.code??error.message;
  console.error(/^[A-Z_0-9]{3,100}$/.test(code??'')?code:'AUTOMACAO_INTERROMPIDA');process.exitCode=1;
}finally{if(pool)await pool.end();}
