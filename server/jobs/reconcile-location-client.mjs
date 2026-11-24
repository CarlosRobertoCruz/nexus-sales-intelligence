import {planClientReconciliation,captureClientReconciliation,applyClientReconciliation} from '../locationClientReconciliation.mjs';
const [action='help',...options]=process.argv.slice(2);
let pool;
try{
  if(action==='help'){
    if(options.length)throw new Error('COMANDO_INVALIDO');
    console.log('Caso autorizado: atendimento 215431 / OS 47911 / cliente 8211 -> 14926. Uso: reconcile-location-client.mjs plan | capture (ate 4 chamadas no lote 2025-11,2025-12) | apply --accept-client-change --expect-preview SHA256');
  }else{
    if(!['plan','capture','apply'].includes(action))throw new Error('COMANDO_INVALIDO');
    let expectedPreview;
    if(action==='apply'){
      if(options.length!==3||options[0]!=='--accept-client-change'||options[1]!=='--expect-preview'||!/^[a-f0-9]{64}$/.test(options[2]))throw new Error('RECONCILIACAO_PREVIA_OBRIGATORIA');
      expectedPreview=options[2];
    }else if(options.length)throw new Error('COMANDO_INVALIDO');
    ({pool}=await import('../db.mjs'));
    let result;
    if(action==='plan')result=await planClientReconciliation(pool);
    else if(action==='apply')result=await applyClientReconciliation(pool,{acceptClientChange:true,expectedPreview});
    else{
      const {HubsoftClient}=await import('../hubsoft.mjs'),{HubsoftGate}=await import('../hubsoftGate.mjs');
      const client=new HubsoftClient(process.env,fetch,undefined,new HubsoftGate(pool,process.env));
      result=await captureClientReconciliation(pool,client);
    }
    console.log(JSON.stringify(result,null,2));
  }
}catch(error){const code=error.code??error.message;console.error(/^[A-Z_0-9]{3,100}$/.test(code??'')?code:'RECONCILIACAO_INTERROMPIDA');process.exitCode=1;}
finally{if(pool)await pool.end();}
