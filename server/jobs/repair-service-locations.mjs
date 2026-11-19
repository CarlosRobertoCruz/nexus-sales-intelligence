import {inventoryServiceLocations,planServiceLocations,captureServiceLocations,applyServiceLocations} from '../locationServiceRepair.mjs';
import {locationRepairMonths} from '../locationRecovery.mjs';
const [action='help',scope,...options]=process.argv.slice(2);
let pool;
try {
  if(action==='help')console.log('Uso: repair-service-locations.mjs inventory anos (ex.: 2025,2026) | plan meses [--all-events] | capture meses [4..100 chamadas] [--all-events] [--retry-unresolved] [--defer-client-conflicts] | apply meses --accept-current-service-address [--all-events]');
  else if(action==='inventory') {
    if(options.length)throw new Error('COMANDO_INVALIDO');
    ({pool}=await import('../db.mjs'));
    const result=await inventoryServiceLocations(pool,scope);
    console.table(result.months);
    console.log(JSON.stringify({years:result.years,totals:result.totals,published:result.published},null,2));
  }
  else {
    if(!['plan','capture','apply'].includes(action))throw new Error('COMANDO_INVALIDO');
    locationRepairMonths(scope);
    const flags=options.filter(value=>value.startsWith('--')),numbers=options.filter(value=>!value.startsWith('--'));
    const allowed=action==='capture'?['--all-events','--retry-unresolved','--defer-client-conflicts']:action==='apply'?['--all-events','--accept-current-service-address']:['--all-events'];
    if(new Set(flags).size!==flags.length||flags.some(flag=>!allowed.includes(flag))||numbers.length>(action==='capture'?1:0))throw new Error('COMANDO_INVALIDO');
    if(action==='apply'&&!flags.includes('--accept-current-service-address'))throw new Error('LOCALIDADE_REVISAO_ENDERECO_ATUAL_OBRIGATORIA');
    const maxCalls=Number(numbers[0]??4),allEvents=flags.includes('--all-events'),deferClientConflicts=flags.includes('--defer-client-conflicts');
    if(action==='capture'&&(!Number.isInteger(maxCalls)||maxCalls<4||maxCalls>100))throw new Error('LOCALIDADE_ORCAMENTO_INVALIDO');
    ({pool}=await import('../db.mjs'));
    if(action==='plan')console.log(JSON.stringify(await planServiceLocations(pool,scope,{allEvents}),null,2));
    else if(action==='apply')console.log(JSON.stringify(await applyServiceLocations(pool,scope,{acceptCurrentServiceAddress:true,allEvents}),null,2));
    else {
      const {HubsoftClient}=await import('../hubsoft.mjs'),{HubsoftGate}=await import('../hubsoftGate.mjs');
      const client=new HubsoftClient(process.env,fetch,undefined,new HubsoftGate(pool,process.env));
      console.log(JSON.stringify({stage:'capture_started',maximumCallsThisRun:maxCalls,scope:allEvents?'all_events':'sales',deferClientConflicts,published:false}));
      console.log(JSON.stringify(await captureServiceLocations(pool,client,scope,{maxCalls,allEvents,deferClientConflicts,retryUnresolved:flags.includes('--retry-unresolved')}),null,2));
    }
  }
}catch(error){const code=error.code??error.message;console.error(/^[A-Z_0-9]{3,100}$/.test(code??'')?code:'LOCALIDADE_REPARO_INTERROMPIDO');process.exitCode=1;}
finally{if(pool)await pool.end();}
