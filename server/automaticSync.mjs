import {createHash} from 'node:crypto';
import {createHistoryJob,historyStep,historyStatus,controlHistoryJob} from './history.mjs';
import {automaticManifest,validateAutomaticConfig,saoPauloDay,shiftDay,endOfMonth,monthIndex,monthAt} from './automaticPolicy.mjs';
import {daysFor,monthsFor,localDay,exactId,assertContractRecord} from './historyPolicy.mjs';
import {markCapturedDrafts} from './historyDrafts.mjs';
import {upsertRows,rebuild} from './records.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function assertAutomaticEnabled(env) {
  if(env.HUBSOFT_AUTOMATIC_ENABLED!=='true'||env.HUBSOFT_HISTORY_IP_COORDINATED!=='true'||Number(env.HUBSOFT_REQUESTS_PER_SECOND??1)!==1) fail('SINCRONIZACAO_AUTOMATICA_DESATIVADA');
}
async function locked(pool,key,work) {
  const db=await pool.connect();let acquired=false;
  try {
    acquired=(await db.query('SELECT pg_try_advisory_lock($1) AS locked',[key])).rows[0].locked;
    if(!acquired) fail('SINCRONIZACAO_EM_ANDAMENTO');
    return await work(db);
  } finally {try{if(acquired)await db.query('SELECT pg_advisory_unlock($1)',[key]);}finally{db.release();}}
}
export async function configureAutomaticSync(pool,input) {
  const config=validateAutomaticConfig(input);
  return locked(pool,73190605,async db=>{
    const existing=(await db.query('SELECT * FROM automatic_sync WHERE id=1')).rows[0];
    if(existing) fail('AUTOMACAO_JA_CONFIGURADA');
    const parent=(await db.query("SELECT manifest FROM history_jobs WHERE id=$1 AND phase='october' AND approved AND state='complete'",[config.approvedOctoberJob])).rows[0];
    if(parent?.manifest.osDateField!=='data_termino_executado') fail('PILOTO_OUTUBRO_OBRIGATORIO');
    await db.query('INSERT INTO automatic_sync(id,config) VALUES(1,$1::jsonb)',[JSON.stringify(config)]);
    return automaticStatus(db);
  });
}
export async function automaticStatus(db) {
  const row=(await db.query('SELECT * FROM automatic_sync WHERE id=1')).rows[0];
  if(!row) return {configured:false,enabled:false};
  return {...row,configured:true,...(row.active_job?{job:await historyStatus(db,row.active_job)}:{})};
}
export async function controlAutomaticSync(pool,action,env) {
  if(!['enable','pause','resume'].includes(action)) fail('COMANDO_INVALIDO');
  if(action!=='pause') assertAutomaticEnabled(env);
  return locked(pool,73190605,async db=>{
    const row=(await db.query('SELECT * FROM automatic_sync WHERE id=1')).rows[0];
    if(!row) fail('AUTOMACAO_NAO_CONFIGURADA');
    if(action==='resume'&&row.active_job) await controlHistoryJob(db,row.active_job,'start');
    await db.query('UPDATE automatic_sync SET enabled=$1,error_code=CASE WHEN $1 THEN NULL ELSE error_code END,updated_at=now() WHERE id=1',[action!=='pause']);
    return automaticStatus(db);
  });
}

// Fail closed on missing previously published identities. API validation is
// recorded independently; no spreadsheet hashes/reviewers are manufactured.
export async function publishAutomaticMonth(pool,id) {
  return locked(pool,73190602,async db=>{
    await db.query('BEGIN');
    try {
      const job=(await db.query('SELECT * FROM history_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(job?.phase!=='automatic'||job.state!=='awaiting_validation') fail('CARGA_AUTOMATICA_NAO_AGUARDA_VALIDACAO');
      const m=job.manifest,month=monthsFor(m)[job.month_index],days=new Set(daysFor(m,month));
      const pages=(await db.query('SELECT day::text,stream,page,processed,complete FROM history_pages WHERE job_id=$1 ORDER BY day,stream,page',[id])).rows;
      for(const day of days) for(const stream of ['attendance','attendanceChanges','serviceOrderCompletions']) {
        const sequence=pages.filter(p=>p.day===day&&p.stream===stream);
        if(!sequence.length||sequence.some((p,i)=>!p.processed||p.page!==i||(p.complete&&i!==sequence.length-1))||!sequence.at(-1).complete) fail('PAGINACAO_AUTOMATICA_INCOMPLETA');
      }
      await markCapturedDrafts(db,id,month);
      const records=(await db.query('SELECT kind,upstream_id,payload,origin FROM history_records WHERE job_id=$1 AND month=$2 ORDER BY kind,upstream_id',[id,month])).rows;
      if(Number((await db.query('SELECT count(*) AS n FROM history_records WHERE job_id=$1',[id])).rows[0].n)>50000) fail('BASE_ATINGIU_LIMITE_50000_REGISTROS');
      for(const r of records) {
        assertContractRecord(r.kind,r.payload);
        if(exactId(r.payload[r.kind==='attendance'?'id_atendimento':'id_ordem_servico'])!==r.upstream_id) fail('IDENTIDADE_AUTOMATICA_DIVERGENTE');
        if(r.payload.classification_status==='incomplete') fail('REVISAO_CAMPOS_INCOMPLETOS_OBRIGATORIA');
        const day=localDay(r.kind==='attendance'?r.payload.data_cadastro:r.payload.data_termino_executado,r.kind!=='attendance');
        if(day<m.startDate||(r.origin!=='context'&&day>m.cutoff)) fail('REGISTRO_FORA_DO_ESCOPO_AUTOMATICO');
      }
      const existing=(await db.query(`SELECT kind,id,payload FROM source_records WHERE
        COALESCE(payload->>'publication_scope','published')='published' AND id LIKE 'hubsoft:%'`)).rows;
      for(const r of existing) {
        const date=r.kind==='attendance'?r.payload.data_cadastro:r.payload.data_termino_executado;
        if(!date||!days.has(localDay(date,r.kind!=='attendance'))) continue;
        const id=exactId(r.payload[r.kind==='attendance'?'id_atendimento':'id_ordem_servico']);
        if(!records.some(record=>record.kind===r.kind&&record.upstream_id===id)) fail('REGISTRO_PUBLICADO_AUSENTE_NA_API');
      }
      const at=new Date().toISOString();
      for(const kind of ['attendance','serviceOrders']) await upsertRows(db,kind,records.filter(r=>r.kind===kind).map(r=>({...r.payload,
        sync_job_id:id,sync_observed_at:at,...(r.origin!=='context'?{publication_scope:'published'}:{})})),'hubsoft');
      await rebuild(db);
      const audit={validation:'api_snapshot',externalReportReconciled:false,at,
        snapshotSha256:createHash('sha256').update(JSON.stringify(records)).digest('hex'),
        records:records.length,discardedDrafts:records.filter(r=>r.payload.classification_status==='discarded_draft').length,
        ordersWithParentBeforeScope:records.filter(r=>r.payload.context_status==='before_scope').length};
      await db.query("UPDATE history_months SET state='published',reconciliation=$3::jsonb WHERE job_id=$1 AND month=$2",[id,month,JSON.stringify(audit)]);
      const done=job.month_index+1===monthsFor(m).length;
      await db.query("UPDATE history_jobs SET state=$2,month_index=month_index+1,next_at=now()+interval '5 minutes',error_code=NULL,updated_at=now() WHERE id=$1",[id,done?'complete':'running']);
      // approved remains false: automatic checks are not a human report approval.
      await db.query('COMMIT');return historyStatus(db,id);
    }catch(error){await db.query('ROLLBACK');throw error;}
  });
}

export function dailyWindow(today,startDate='2025-01-01',cursor=null) {
  const cycleCutoff=shiftDay(today,-1),from=cursor??[shiftDay(cycleCutoff,-29),startDate].sort().at(-1);
  if(cycleCutoff<startDate) return null;
  const first=from.slice(0,7),last=cycleCutoff.slice(0,7);
  const lastMonth=monthAt(Math.min(monthIndex(first)+1,monthIndex(last)));
  const cutoff=[endOfMonth(lastMonth),cycleCutoff].sort()[0];
  return {from,cutoff,cycleCutoff,months:first===lastMonth?[first]:[first,lastMonth]};
}
export async function automaticTick(pool,client,env,{now=new Date()}={}) {
  assertAutomaticEnabled(env);
  if(client.gate?.interval!==1000) fail('AUTOMACAO_EXIGE_GATE_1_REQ_S');
  return locked(pool,73190605,async db=>{
    const state=(await db.query('SELECT *,last_daily_on::text AS last_daily_day,daily_cycle_day::text AS cycle_day,daily_next_day::text AS cursor FROM automatic_sync WHERE id=1')).rows[0];
    if(!state||!state.enabled||state.error_code||new Date(state.next_at)>now) return automaticStatus(db);
    validateAutomaticConfig(state.config);
    if(!state.active_job) {
      const today=saoPauloDay(now),daily=dailyWindow(today,state.config.startDate,state.cycle_day===today?state.cursor:null);
      if(!daily) return {...await automaticStatus(db),message:'NENHUM_DIA_COMPLETO_NO_ESCOPO'};
      const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(now));
      let manifest;
      if(state.last_daily_day!==today&&hour>=2) manifest=automaticManifest(state.config,'daily',daily.months,daily.from,daily.cutoff,today,daily.cycleCutoff);
      else {
        const published=(await db.query(`SELECT DISTINCT m.month FROM history_months m JOIN history_jobs j ON j.id=m.job_id
          WHERE m.state='published' AND ((j.phase='automatic' AND j.manifest->>'mode'='backfill') OR j.approved)`)).rows.map(r=>r.month);
        const first=monthIndex(state.config.backfillFrom),last=monthIndex(today.slice(0,7))-1;
        const months=Array.from({length:Math.max(0,last-first+1)},(_,i)=>monthAt(first+i)).filter(month=>!published.includes(month));
        if(!months.length) return automaticStatus(db);
        const batch=[months[0]];if(months[1]&&monthIndex(months[1])===monthIndex(months[0])+1) batch.push(months[1]);
        manifest=automaticManifest(state.config,'backfill',batch,batch[0]+'-01',endOfMonth(batch.at(-1)),today);
      }
      // Record job + active pointer atomically. Restart cannot create a second job.
      await db.query('BEGIN');
      try {
        const id=await createHistoryJob(db,manifest);
        await db.query("UPDATE history_jobs SET state='running' WHERE id=$1",[id]);
        await db.query('UPDATE automatic_sync SET active_job=$1,updated_at=now() WHERE id=1',[id]);
        await db.query('COMMIT');
      }catch(error){await db.query('ROLLBACK');throw error;}
      return automaticStatus(db);
    }
    try {
      let status=await historyStep(pool,client,state.active_job);
      if(status.state==='awaiting_validation') status=await publishAutomaticMonth(pool,state.active_job);
      if(status.state==='complete') {
        const m=(await db.query('SELECT manifest FROM history_jobs WHERE id=$1',[state.active_job])).rows[0].manifest;
        const completeCycle=m.mode==='daily'&&m.cutoff===m.cycleCutoff;
        const more=m.mode==='daily'&&!completeCycle;
        await db.query(`UPDATE automatic_sync SET active_job=NULL,next_at=$1,last_daily_on=CASE WHEN $2 THEN $3::date ELSE last_daily_on END,
          daily_cycle_day=CASE WHEN $4 THEN $3::date ELSE NULL END,daily_next_day=$5,updated_at=now() WHERE id=1`,
        [status.next_at,completeCycle,m.cycleDay,more,more?shiftDay(m.cutoff,1):null]);
      }else if(['paused','cancelled'].includes(status.state)) {
        await db.query("UPDATE automatic_sync SET error_code=$1,updated_at=now() WHERE id=1",[status.error_code??'CARGA_AUTOMATICA_INTERROMPIDA']);
      }
    }catch(error) {
      if(['SINCRONIZACAO_EM_ANDAMENTO','HUBSOFT_FILA_OCUPADA'].includes(error.code)) return automaticStatus(db);
      const code=/^[A-Z_0-9]{3,100}$/.test(error.code??error.message)?(error.code??error.message):'AUTOMACAO_INTERROMPIDA';
      await db.query("UPDATE history_jobs SET state='paused',error_code=$2 WHERE id=$1 AND state<>'complete'",[state.active_job,code]);
      await db.query('UPDATE automatic_sync SET error_code=$1,updated_at=now() WHERE id=1',[code]);
    }
    return automaticStatus(db);
  });
}
