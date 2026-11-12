import {createHash,randomUUID} from 'node:crypto';
import {classifyStoredRows,KINDS} from './records.mjs';
import {exactId,localDay} from './historyPolicy.mjs';
import {clientCode,normalizeDate} from './historyNormalization.mjs';
import {extractLocationFields,serviceIdentity} from './locationFields.mjs';
import {canonicalLocation} from '../server-dist/commercial.js';

const fail=code=>{throw Object.assign(new Error(code),{code});};
export function locationRepairMonths(value) {
  const months=String(value??'').split(',');
  if(months.length<1||months.length>2||new Set(months).size!==months.length||months.some(month=>
    !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)||month<'2025-01'||month>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}).slice(0,7)))fail('MESES_LOCALIZACAO_INVALIDOS');
  return months.sort();
}
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const monthOf=value=>new Date(value).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}).slice(0,7);
function sameAttendance(source,detail) {
  try {
    return !detail.deleted_at&&exactId(source.id_atendimento)===exactId(detail.id_atendimento)
      &&exactId(source.protocolo)===exactId(detail.protocolo)
      &&exactId(source.codigo_cliente)===exactId(clientCode(detail))
      &&localDay(source.data_cadastro)===localDay(normalizeDate(detail.data_cadastro_br??detail.data_cadastro))
      &&(!serviceIdentity(source)||!serviceIdentity(detail)||serviceIdentity(source)===serviceIdentity(detail));
  }catch{return false;}
}
function stable(value) {
  if(value instanceof Date)return value.toISOString();
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
function nonGeographicEvents(classified) {
  return JSON.stringify(stable(Object.fromEntries(KINDS.map(kind=>[kind,(classified?.[kind]??[]).map(({location:_location,...event})=>event)
    .sort((a,b)=>String(a.businessKey??a.id).localeCompare(String(b.businessKey??b.id)))]))));
}
function summary(classified,months) {
  return months.map(month=>{
    const result={month};
    for(const kind of ['sales','renewals','cancellations']) {
      const events=(classified?.[kind]??[]).filter(event=>monthOf(event.date)===month);
      result[kind]={total:events.length,withoutLocation:events.filter(event=>!canonicalLocation(event.location)).length};
    }
    return result;
  });
}
export async function repairLocations(pool,months,{apply=false}={}) {
  months=locationRepairMonths(months.join(','));
  const db=await pool.connect();
  try {
    await db.query(apply?'BEGIN':'BEGIN READ ONLY');
    if(apply&&!(await db.query('SELECT pg_try_advisory_xact_lock(73190602) AS locked')).rows[0].locked)fail('SINCRONIZACAO_EM_ANDAMENTO');
    const rows=(await db.query(`SELECT kind,id,payload FROM source_records
      WHERE COALESCE(payload->>'publication_scope','published')<>'manual_staging' ORDER BY kind,id${apply?' FOR UPDATE':''}`)).rows;
    const targets=(await db.query(`SELECT payload->>'attendanceId' AS attendance_id,payload->>'id' AS event_id,kind,payload,event_date FROM commercial_records
      WHERE kind IN ('sales','renewals','cancellations') AND to_char(event_date AT TIME ZONE 'America/Sao_Paulo','YYYY-MM')=ANY($1::text[])`,[months])).rows;
    const ids=new Set(targets.filter(r=>r.kind==='sales').map(r=>r.attendance_id).filter(Boolean));
    const protocols=new Set(targets.filter(r=>r.kind!=='sales').map(r=>r.event_id));
    const candidates=rows.filter(r=>r.kind==='attendance'&&(ids.has(r.id)||protocols.has(String(r.payload.protocolo)))&&r.id.startsWith('hubsoft:'));
    const october=(await db.query("SELECT config->>'approvedOctoberJob' AS id FROM automatic_sync WHERE id=1")).rows[0]?.id;
    const cacheKeys=new Map();
    for(const row of candidates) {
      const jobs=[row.payload.sync_job_id,row.payload.context_job_id,
        localDay(row.payload.data_cadastro).startsWith('2026-10')?october:null].filter(Boolean);
      cacheKeys.set(row.id,[...new Set(jobs)].map(job=>`hubsoft_history_protocol:${job}:${row.payload.id_atendimento}`));
    }
    const keys=[...new Set([...cacheKeys.values()].flat())];
    const cached=keys.length?(await db.query('SELECT key,value FROM application_settings WHERE key=ANY($1::text[])',[keys])).rows:[];
    const byKey=new Map(cached.map(row=>[row.key,row.value]));
    const changes=new Map(),evidence=[];
    let cacheMatches=0,cacheDivergences=0;
    for(const row of candidates) {
      const sources=cacheKeys.get(row.id).map(key=>({key,...byKey.get(key)})).filter(value=>value.record);
      const verified=sources.filter(value=>sameAttendance(row.payload,value.record));
      cacheMatches+=verified.length;cacheDivergences+=sources.length-verified.length;
      const current=extractLocationFields(row.payload);
      const additions={};
      for(const field of ['bairro','cidade']) {
        if(current[field])continue;
        const values=new Set(verified.map(value=>extractLocationFields(value.record)[field]).filter(Boolean));
        if(values.size>1){cacheDivergences++;continue;}
        if(values.size===1)additions[field]=[...values][0];
      }
      if(!Object.keys(additions).length)continue;
      evidence.push({source:row.id,kind:row.kind,beforeSha256:hash(row.payload),cacheSha256:verified.map(value=>hash(value.record))});
      changes.set(`${row.kind}:${row.id}`,{...row.payload,...additions,location_recovery:{source:'verified_attendance_cache',observedAt:new Date().toISOString()}});
    }
    const projected=rows.map(row=>({...row,payload:changes.get(`${row.kind}:${row.id}`)??row.payload}));
    const baseline=classifyStoredRows(rows),after=classifyStoredRows(projected);
    if(nonGeographicEvents(baseline)!==nonGeographicEvents(after))fail('REPARO_LOCALIZACAO_ALTERARIA_INDICADORES');
    const publishedRows=(await db.query('SELECT kind,payload FROM commercial_records ORDER BY kind,id')).rows;
    const published=Object.fromEntries(KINDS.map(kind=>[kind,publishedRows.filter(row=>row.kind===kind).map(row=>row.payload)]));
    if(nonGeographicEvents(published)!==nonGeographicEvents(after))fail('REPARO_LOCALIZACAO_ALTERARIA_INDICADORES_PUBLICADOS');
    const before=published;
    const report={mode:apply?'apply':'plan',months,cacheMatches,cacheDivergences,sourceUpdates:changes.size,
      before:summary(before,months),after:summary(after,months)};
    if(apply) {
      for(const row of projected)if(changes.has(`${row.kind}:${row.id}`))await db.query('UPDATE source_records SET payload=$3::jsonb,updated_at=now() WHERE kind=$1 AND id=$2',[row.kind,row.id,JSON.stringify(row.payload)]);
      // Only the requested geographical fields are published; other months and attributes stay intact.
      for(const kind of ['sales','renewals','cancellations'])for(const event of after?.[kind]??[]) {
        if(!months.includes(monthOf(event.date)))continue;
        await db.query("UPDATE commercial_records SET payload=jsonb_set(payload,'{location}',$3::jsonb) WHERE kind=$1 AND id=$2 AND payload->>'location' IS DISTINCT FROM $4",
          [kind,event.businessKey??event.id,JSON.stringify(event.location),event.location]);
      }
      const auditId=`location_repair:${randomUUID()}`;
      await db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb)',[auditId,JSON.stringify({...report,at:new Date().toISOString(),evidence})]);
      report.auditId=auditId;
    }
    await db.query(apply?'COMMIT':'ROLLBACK');
    return report;
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
