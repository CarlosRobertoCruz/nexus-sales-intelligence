import {planServiceLocations,captureServiceLocations,applyServiceLocations} from '../locationServiceRepair.mjs';
import {locationRepairMonths} from '../locationRecovery.mjs';
const [action='help',scope,option]=process.argv.slice(2);
let pool;
try {
  if(action==='help')console.log('Uso: repair-service-locations.mjs plan meses | capture meses [4..100 chamadas] | apply meses --accept-current-service-address');
  else {
    if(!['plan','capture','apply'].includes(action))throw new Error('COMANDO_INVALIDO');
    locationRepairMonths(scope);
    if(action==='apply'&&option!=='--accept-current-service-address')throw new Error('LOCALIDADE_REVISAO_ENDERECO_ATUAL_OBRIGATORIA');
    const maxCalls=Number(option??4);
    if(action==='capture'&&(!Number.isInteger(maxCalls)||maxCalls<4||maxCalls>100))throw new Error('LOCALIDADE_ORCAMENTO_INVALIDO');
    ({pool}=await import('../db.mjs'));
    if(action==='plan')console.log(JSON.stringify(await planServiceLocations(pool,scope),null,2));
    else if(action==='apply')console.log(JSON.stringify(await applyServiceLocations(pool,scope,{acceptCurrentServiceAddress:true}),null,2));
    else {
      const {HubsoftClient}=await import('../hubsoft.mjs'),{HubsoftGate}=await import('../hubsoftGate.mjs');
      const client=new HubsoftClient(process.env,fetch,undefined,new HubsoftGate(pool,process.env));
      console.log(JSON.stringify({stage:'capture_started',maximumCallsThisRun:maxCalls,published:false}));
      console.log(JSON.stringify(await captureServiceLocations(pool,client,scope,{maxCalls}),null,2));
    }
  }
}catch(error){const code=error.code??error.message;console.error(/^[A-Z_0-9]{3,100}$/.test(code??'')?code:'LOCALIDADE_REPARO_INTERROMPIDO');process.exitCode=1;}
finally{if(pool)await pool.end();}
