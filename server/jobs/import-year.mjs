import { readFile,writeFile } from 'node:fs/promises';
import { validateManifest,monthsFor,daysFor } from '../historyPolicy.mjs';
const [action='help',argument,evidenceFile]=process.argv.slice(2);
const commands=['plan','create','status','start','pause','cancel','run','approve','export-ids','export-followup'];
let pool;
try {
  if(action==='help') { console.log('Uso: node server/jobs/import-year.mjs plan|create manifesto.json; status|start|pause|cancel|run UUID; approve UUID evidencia.json; export-ids|export-followup UUID arquivo.json'); }
  else if(!commands.includes(action)||!argument) throw new Error('COMANDO_INVALIDO');
  else if(action==='plan') {
    const manifest=validateManifest(JSON.parse(await readFile(argument,'utf8')));
    console.log(JSON.stringify({phase:manifest.phase,cutoff:manifest.cutoff,months:monthsFor(manifest),days:monthsFor(manifest).reduce((n,month)=>n+daysFor(manifest,month).length,0),maximumCalls:manifest.maxCalls,osDateField:manifest.osDateField,followupCutoff:manifest.followupCutoff??null,enabled:false},null,2));
  } else {
    ({pool}=await import('../db.mjs'));
    const {createHistoryJob,historyStatus,controlHistoryJob,historyStep,approveHistoryMonth}=await import('../history.mjs');
    if(action==='create') console.log(JSON.stringify({id:await createHistoryJob(pool,JSON.parse(await readFile(argument,'utf8')))}));
    else {
      if(!/^[a-f\d-]{36}$/i.test(argument)) throw new Error('ID_CARGA_INVALIDO');
      if(action==='status') console.log(JSON.stringify(await historyStatus(pool,argument),null,2));
      else if(['start','pause','cancel'].includes(action)) {
        if(action==='start' && (process.env.HUBSOFT_HISTORY_ENABLED!=='true'||process.env.HUBSOFT_HISTORY_IP_COORDINATED!=='true')) throw new Error('CARGA_HISTORICA_DESATIVADA');
        console.log(JSON.stringify(await controlHistoryJob(pool,argument,action),null,2));
      } else if(action==='approve') {
        if(process.env.HUBSOFT_HISTORY_ENABLED!=='true'||process.env.HUBSOFT_HISTORY_IP_COORDINATED!=='true') throw new Error('CARGA_HISTORICA_DESATIVADA');
        console.log(JSON.stringify(await approveHistoryMonth(pool,argument,JSON.parse(await readFile(evidenceFile,'utf8'))),null,2));
      } else if(action==='export-followup') {
        if(!evidenceFile) throw new Error('ARQUIVO_DESTINO_OBRIGATORIO');
        const {followupReport}=await import('../historyFollowup.mjs');
        await writeFile(evidenceFile,JSON.stringify(await followupReport(pool,argument),null,2),{mode:0o600});
        console.log('Acompanhamento exportado: vínculos, datas e estados observados; separado da produção.');
      } else if(action==='export-ids') {
        if(!evidenceFile) throw new Error('ARQUIVO_DESTINO_OBRIGATORIO');
        const rows=(await pool.query('SELECT month,kind,upstream_id FROM history_records WHERE job_id=$1 ORDER BY month,kind,upstream_id',[argument])).rows;
        await writeFile(evidenceFile,JSON.stringify(rows,null,2),{mode:0o600});
        console.log('IDs exportados para reconciliação local; nenhum dado de cliente foi incluído.');
      } else {
        if(process.env.HUBSOFT_HISTORY_ENABLED!=='true'||process.env.HUBSOFT_HISTORY_IP_COORDINATED!=='true') throw new Error('CARGA_HISTORICA_DESATIVADA');
        const {HubsoftClient}=await import('../hubsoft.mjs');
        const {HubsoftGate}=await import('../hubsoftGate.mjs');
        const client=new HubsoftClient(process.env,fetch,undefined,new HubsoftGate(pool,process.env));
        let stop=false;
        process.on('SIGTERM',()=>{stop=true;}); process.on('SIGINT',()=>{stop=true;});
        while(!stop) {
          let status;
          try {status=await historyStep(pool,client,argument);}
          catch(error) {if(error.code==='SINCRONIZACAO_EM_ANDAMENTO'){await new Promise(resolve=>setTimeout(resolve,1000));continue;}throw error;}
          console.log(JSON.stringify(status));
          if(status.state==='awaiting_validation') {
            const job=(await pool.query('SELECT * FROM history_jobs WHERE id=$1',[argument])).rows[0];
            if(job.phase==='history' && job.manifest.autoPublish) {
              const month=monthsFor(job.manifest)[job.month_index],reports=job.manifest.monthReports[month];
              await approveHistoryMonth(pool,argument,{month,reviewer:job.manifest.reviewer,confirmFilters:true,
                attendance:{ids:reports.attendance.ids,reportSha256:reports.attendance.fileSha256},
                serviceOrders:{ids:reports.serviceOrders.ids,reportSha256:reports.serviceOrders.fileSha256},
                ...(job.manifest.followupCutoff?{followup:{ids:reports.followup.ids,reportSha256:reports.followup.fileSha256}}:{})});
              continue;
            }
          }
          if(status.state!=='running') break;
          const remaining=Math.max(0,new Date(status.next_at).getTime()-Date.now());
          if(remaining>0) await new Promise(resolve=>setTimeout(resolve,Math.min(remaining,15000)));
        }
      }
    }
  }
} catch(error) {
  const code=error.code??error.message;
  console.error(/^[A-Z_0-9]{3,100}$/.test(code??'')?code:'COMANDO_INTERROMPIDO');
  process.exitCode=1;
} finally { if(pool) await pool.end(); }
