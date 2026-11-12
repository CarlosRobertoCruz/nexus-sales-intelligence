import {locationRepairMonths,repairLocations} from '../locationRecovery.mjs';
const [action='help',scope]=process.argv.slice(2);
let pool;
try {
  if(action==='help')console.log('Uso: node server/jobs/rebuild-locations.mjs plan|apply 2025-10,2026-10');
  else {
    if(!['plan','apply'].includes(action))throw new Error('COMANDO_INVALIDO');
    const months=locationRepairMonths(scope);
    ({pool}=await import('../db.mjs'));
    console.log(JSON.stringify(await repairLocations(pool,months,{apply:action==='apply'}),null,2));
  }
}catch(error){const code=error.code??error.message;console.error(/^[A-Z_0-9]{3,100}$/.test(code??'')?code:'REPARO_LOCALIZACAO_INTERROMPIDO');process.exitCode=1;}
finally{if(pool)await pool.end();}
