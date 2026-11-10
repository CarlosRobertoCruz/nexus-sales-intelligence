import { randomUUID } from 'node:crypto';
import {clientCode,normalized,normalizedAttendanceDetail,normalizeDate} from './historyNormalization.mjs';
import {automaticEnrichmentStep,checkedOrders} from './automaticEnrichment.mjs';
import {safeHubsoftDiagnostic,HubsoftMappingError} from './hubsoftDiagnostics.mjs';
import {compareHistoryReport} from './historyReconciliation.mjs';
import { validateManifest,monthsFor,daysFor,exactId,localDay,nextWindowAt,usesProtocolPilot,OCTOBER_PROTOCOL_JOB_ID } from './historyPolicy.mjs';
import { upsertRows,rebuild } from './records.mjs';
import { projectHistoryRecord } from './historyProjection.mjs';
import {orderDate,stageFollowups,publishFollowups} from './historyFollowup.mjs';
import {markCapturedDrafts} from './historyDrafts.mjs';
const codeError=code=>Object.assign(new Error(code),{code});
const streams=['attendance','attendanceChanges','serviceOrders','serviceOrderCompletions'];

export async function createHistoryJob(db,manifest) {
  validateManifest(manifest);
  if(['history','automatic'].includes(manifest.phase)) {
    const parent=(await db.query("SELECT * FROM history_jobs WHERE id=$1 AND phase='october' AND approved AND state='complete'",[manifest.approvedOctoberJob])).rows[0];
    if(!parent || parent.manifest.osDateField!==manifest.osDateField || (manifest.phase==='history'&&Boolean(parent.manifest.followupCutoff)!==Boolean(manifest.followupCutoff))) throw codeError('PILOTO_OUTUBRO_OBRIGATORIO');
  }
  if(manifest.phase==='october') {
    const parent=(await db.query("SELECT id,manifest FROM history_jobs WHERE id=$1 AND phase='day' AND approved AND state='complete'",[manifest.approvedDayJob])).rows[0];
    if(!parent || parent.manifest.osDateField!==manifest.osDateField || Boolean(parent.manifest.followupCutoff)!==Boolean(manifest.followupCutoff)) throw codeError('PILOTO_DIARIO_OBRIGATORIO');
  }
  const id=randomUUID();
  await db.query('INSERT INTO history_jobs(id,phase,manifest) VALUES($1,$2,$3::jsonb)',[id,manifest.phase,JSON.stringify(manifest)]);
  if(manifest.phase==='history') await db.query(`UPDATE history_jobs SET next_at=GREATEST(next_at,
    (SELECT next_at FROM history_jobs WHERE id=$2),
    (SELECT max(next_at) FROM history_jobs WHERE phase='history' AND approved AND state='complete')) WHERE id=$1`,[id,manifest.approvedOctoberJob]);
  return id;
}
export async function historyStatus(db,id) {
  const job=(await db.query("SELECT id,phase,state,month_index,next_at,error_code,approved,(manifest ? 'followupCutoff') AS has_followup,COALESCE(manifest->>'enrichmentStrategy','client') AS enrichment_strategy FROM history_jobs WHERE id=$1",[id])).rows[0];
  if(!job) throw codeError('CARGA_NAO_ENCONTRADA');
  const totals=(await db.query(`SELECT kind,count(*)::int AS unique_records,count(*) FILTER(WHERE payload->>'classification_status'='incomplete')::int AS incomplete_records FROM history_records WHERE job_id=$1 GROUP BY kind`,[id])).rows;
  const pages=(await db.query('SELECT count(*)::int AS pages,count(*) FILTER(WHERE processed)::int AS processed FROM history_pages WHERE job_id=$1',[id])).rows[0];
  const calls=(await db.query(`SELECT count(*)::int AS calls,count(*) FILTER(WHERE status=429)::int AS rate_limited,
    count(*) FILTER(WHERE method='POST')::int AS oauth_calls,avg(latency_ms) AS latency_avg_ms,
    max(latency_ms) AS latency_max_ms,percentile_cont(0.95) WITHIN GROUP(ORDER BY latency_ms) AS latency_p95_ms FROM hubsoft_call_metrics WHERE job_id=$1`,[id])).rows[0];
  const followup=job.has_followup ? (await db.query(`SELECT
    (SELECT count(*)::int FROM history_followup_attendances WHERE job_id=$1) AS attendances,
    (SELECT count(*)::int FROM history_followup_orders WHERE job_id=$1) AS linked_orders,
    (SELECT max(observed_at) FROM history_followup_attendances WHERE job_id=$1) AS last_observed_at`,[id])).rows[0] : undefined;
  const savedDiagnostic=job.error_code?(await db.query('SELECT value FROM application_settings WHERE key=$1',[`hubsoft_history_diagnostic:${id}`])).rows[0]?.value:undefined;
  const diagnostic=savedDiagnostic?safeHubsoftDiagnostic(new HubsoftMappingError(job.error_code,savedDiagnostic.kind,savedDiagnostic.missingFields,savedDiagnostic.invalidFields)):undefined;
  let scope={};
  if(['history','automatic'].includes(job.phase)) {
    const manifest=(await db.query('SELECT manifest FROM history_jobs WHERE id=$1',[id])).rows[0].manifest;
    const months=monthsFor(manifest);
    const monthTotals=(await db.query('SELECT month,kind,count(*)::int AS records FROM history_records WHERE job_id=$1 GROUP BY month,kind ORDER BY month,kind',[id])).rows;
    scope={months,current_month:months[job.month_index]??null,month_totals:monthTotals};
  }
  return {...job,...scope,totals,pages,calls,...(followup ? {followup} : {}),...(diagnostic ? {diagnostic} : {})};
}
export async function controlHistoryJob(db,id,action) {
  const state=action==='pause'?'paused':action==='cancel'?'cancelled':action==='start'?'running':null;
  if(!state) throw codeError('COMANDO_INVALIDO');
  await db.query(`UPDATE history_jobs SET state=$2,error_code=NULL,updated_at=now()
    WHERE id=$1 AND state NOT IN ('complete','cancelled') AND NOT(state='awaiting_validation' AND $2='running')`,[id,state]);
  return historyStatus(db,id);
}
function businessDay(kind,record,manifest) {
  return localDay(kind==='attendance'?record.data_cadastro:record[manifest.osDateField],kind!=='attendance');
}

// Uma etapa recebe/processa uma página ou resolve um cliente. Nenhum loop remoto ilimitado.
export async function historyStep(pool,client,id) {
  const db=await pool.connect(); let locked=false;
  try {
    locked=(await db.query('SELECT pg_try_advisory_lock(73190602) AS locked')).rows[0].locked;
    if(!locked) throw codeError('SINCRONIZACAO_EM_ANDAMENTO');
    const job=(await db.query('SELECT * FROM history_jobs WHERE id=$1',[id])).rows[0];
    if(!job) throw codeError('CARGA_NAO_ENCONTRADA');
    if(job.state!=='running'||new Date(job.next_at).getTime()>Date.now()) return historyStatus(db,id);
    const m=job.manifest,month=monthsFor(m)[job.month_index];
    const protocolMode=usesProtocolPilot(m,id);
    if((protocolMode||m.phase==='history')&&client.gate?.interval!==undefined&&client.gate.interval!==1000) throw codeError('PILOTO_PROTOCOLO_EXIGE_1_REQ_S');
    if(!month) return historyStatus(db,id);
    const windowAt=nextWindowAt(m.window);
    if(windowAt>Date.now()+1000) {await db.query('UPDATE history_jobs SET next_at=$2 WHERE id=$1',[id,new Date(windowAt)]);return historyStatus(db,id);}
    if(client.gate) client.gate.jobId=id;
    const calls=Number((await db.query('SELECT count(*) AS n FROM hubsoft_call_metrics WHERE job_id=$1',[id])).rows[0].n);
    if(calls>=m.maxCalls) throw codeError('ORCAMENTO_ATINGIDO');
    await db.query('INSERT INTO history_months(job_id,month) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,month]);
    const selectedDays=new Set(daysFor(m,month));
    const activeStreams=m.osDateField==='data_termino_executado'?streams.filter(s=>s!=='serviceOrders'):streams;
    for(const day of selectedDays) for(const stream of activeStreams) {
      const kind=stream.startsWith('attendance')?'attendance':'serviceOrders';
      const saved=(await db.query('SELECT * FROM history_pages WHERE job_id=$1 AND day=$2 AND stream=$3 ORDER BY page DESC LIMIT 1',[id,day,stream])).rows[0];
      if(saved?.processed && saved.complete) continue;
      const page=saved&&!saved.processed?saved.page:(saved?.page??-1)+1;
      let current=saved&&!saved.processed?saved:null;
      if(!current) {
        // Os filtros do manifesto são cobertura de cadastro/programação/conclusão explícita.
        const result=await client.page(stream,day,page,stream==='serviceOrders'?m.osDateField:undefined);
        if(m.phase==='automatic') {
          const field=kind==='attendance'?'id_atendimento':'id_ordem_servico';
          const ids=result.records.map(record=>exactId(record[field]));
          const previous=(await db.query('SELECT records FROM history_pages WHERE job_id=$1 AND day=$2 AND stream=$3',[id,day,stream])).rows;
          const seen=new Set(previous.flatMap(row=>row.records.map(record=>exactId(record[field]))));
          if(new Set(ids).size!==ids.length||ids.some(value=>seen.has(value))) throw codeError('HUBSOFT_PAGINAS_REPETIDAS');
          for(const record of result.records) {
            const value=stream==='attendance'?record.data_cadastro_br??record.data_cadastro:stream==='serviceOrderCompletions'?record.data_termino_executado:record.data_ultima_alteracao??record.updated_at;
            const timestamp=stream==='serviceOrderCompletions'||(stream==='attendanceChanges'&&/[T ]\d{2}:\d{2}/.test(String(value)));
            if(value&&(timestamp?localDay(orderDate(value),true):localDay(normalizeDate(value)))!==day) throw codeError('HUBSOFT_FILTRO_DE_DATA_DIVERGENTE');
          }
        }
        const captured=m.phase==='automatic'&&kind==='attendance'?result.records.filter(record=>{
          const created=localDay(normalizeDate(record.data_cadastro_br??record.data_cadastro));
          return created>=m.startDate&&created<=m.cutoff;
        }):result.records;
        await db.query('INSERT INTO history_pages(job_id,day,stream,page,records,complete) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[id,day,stream,page,JSON.stringify(captured.map(r=>projectHistoryRecord(r))),result.complete]);
        return historyStatus(db,id);
      }
      const rows=[],followups=[];
      for(const raw of current.records) {
        const rawDate=kind==='attendance'?(raw.data_cadastro_br??raw.data_cadastro):raw[m.osDateField];
        // The pilot selects an exact day, not every record in its month. For a
        // completion query an undated order cannot be counted as production.
        if(rawDate) {
          const date=kind==='attendance' ? localDay(normalizeDate(rawDate)) : localDay(orderDate(rawDate),true);
          if(m.phase==='automatic'&&stream==='attendanceChanges') {
            if(date<m.startDate||date>m.cutoff) continue;
            if(!selectedDays.has(date)) {
              const known=(await db.query(`SELECT 1 FROM source_records WHERE kind='attendance' AND id=$1
                AND COALESCE(payload->>'publication_scope','published')='published'`,[`hubsoft:${exactId(raw.id_atendimento)}`])).rows.length;
              // Do not expose a new, partially loaded historical month just
              // because a recent change references an older attendance.
              if(!known) continue;
            }
          } else if(!selectedDays.has(date)) continue;
        } else if(kind==='serviceOrders' && m.osDateField==='data_termino_executado') throw codeError('HUBSOFT_OS_CONCLUSAO_AUSENTE');
        if(raw.deleted_at) throw codeError('EXCLUSAO_EXIGE_RECONCILIACAO');
        let detail=null,cache=null;
        let needsDetail=kind==='attendance' && (Boolean(m.followupCutoff)||m.phase==='automatic');
        if(kind==='attendance'&&!needsDetail) {
          try {normalized(kind,raw);}
          catch(error) {if(!error.diagnostic?.missingFields?.some(field=>['usuario_abertura','descricao_abertura','tipo_atendimento'].includes(field)))throw error;needsDetail=true;}
        }
        if(needsDetail) {
          const customer=exactId(clientCode(raw));
          const created=localDay(normalizeDate(raw.data_cadastro_br??raw.data_cadastro));
          if(!selectedDays.has(created)&&!(m.phase==='automatic'&&stream==='attendanceChanges'&&created>=m.startDate&&created<=m.cutoff)) continue;
          if(protocolMode) {
            const key=`hubsoft_history_protocol:${id}:${exactId(raw.id_atendimento)}`;
            const saved=(await db.query('SELECT value FROM application_settings WHERE key=$1',[key])).rows[0]?.value;
            if(saved) {
              normalizedAttendanceDetail(raw,saved.record,customer,created);
              cache={records:[saved.record],captured_at:saved.observedAt};
            } else {
              const response=await client.attendanceDetail(exactId(raw.protocolo));
              normalizedAttendanceDetail(raw,response,customer,created);
              const value={record:projectHistoryRecord(response),observedAt:new Date().toISOString()};
              await db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb)',[key,JSON.stringify(value)]);
              return historyStatus(db,id);
            }
          } else {
            cache=(await db.query('SELECT * FROM history_clients WHERE job_id=$1 AND client_code=$2 AND day=$3',[id,customer,created])).rows[0];
            if(!cache) {
              const response=await client.clientAttendances(customer,created);
              await db.query('INSERT INTO history_clients(job_id,client_code,day,records) VALUES($1,$2,$3,$4::jsonb)',[id,customer,created,JSON.stringify(response.map(r=>projectHistoryRecord(r)))]);
              return historyStatus(db,id);
            }
          }
          const match=cache.records.filter(item=>String(item.id_atendimento)===exactId(raw.id_atendimento));
          if(match.length!==1) throw codeError('HUBSOFT_ATENDIMENTO_NAO_RESOLVIDO');
          detail=match[0];
          if(localDay(normalizeDate(detail.data_cadastro_br??detail.data_cadastro))!==created) throw codeError('HUBSOFT_ATENDIMENTO_DIA_DIVERGENTE');
        }
        const row=detail?normalizedAttendanceDetail(m.phase==='automatic'?detail:raw,m.phase==='automatic'?raw:detail,exactId(clientCode(raw)),localDay(normalizeDate(raw.data_cadastro_br??raw.data_cadastro))):normalized(kind,raw);
        rows.push({kind,payload:row,origin:'direct'});
        if(kind==='attendance') {
          if(m.phase==='automatic') checkedOrders(detail);
          if(m.followupCutoff) {
            const declared=raw.ordem_servico_count??detail.ordem_servico_count;
            const reportedOrders=declared===undefined||declared===null ? null : /^\d+$/.test(String(declared)) ? Number(declared) : NaN;
            const orders=detail.ordens_servico??(reportedOrders===0?[]:undefined);
            followups.push({parent:row,orders,reportedOrders,observedAt:cache.captured_at});
          }
          // Embedded links contribute production only on the selected completion
          // day. Future, pending and cancelled observations remain in the cohort.
          for(const os of detail?.ordens_servico??raw.ordens_servico??[]) {
            const value=os[m.osDateField];
            if(!value || !selectedDays.has(localDay(orderDate(value),true))) continue;
            const parent=os.id_atendimento??os.atendimento?.id_atendimento;
            if(parent!==undefined&&parent!==null&&exactId(parent)!==exactId(raw.id_atendimento)) throw codeError('VINCULO_OS_DIVERGENTE');
            rows.push({kind:'serviceOrders',payload:normalized('serviceOrders',{...os,cliente:os.cliente??raw.cliente??raw.cliente_servico?.cliente,id_atendimento:raw.id_atendimento}),origin:'embedded'});
          }
        }
      }
      await db.query('BEGIN');
      try {
        // Um pedido de pausa durante a chamada não descarta a página recebida.
        for(const row of rows) {
          const date=businessDay(row.kind,row.payload,m);
          if(!selectedDays.has(date)&&!(m.phase==='automatic'&&row.kind==='attendance'&&stream==='attendanceChanges'&&date>=m.startDate&&date<=m.cutoff)) continue;
          if(row.kind==='serviceOrders'&&m.osDateField==='data_termino_executado') row.payload.data_referencia_bi='data_termino_executado';
          const upstream=exactId(row.payload[row.kind==='attendance'?'id_atendimento':'id_ordem_servico']);
          await db.query(`INSERT INTO history_records(job_id,month,kind,upstream_id,payload,origin) VALUES($1,$2,$3,$4,$5::jsonb,$6)
            ON CONFLICT(job_id,kind,upstream_id) DO UPDATE SET payload=CASE
              WHEN history_records.origin='direct' AND excluded.origin='embedded' THEN history_records.payload ELSE excluded.payload END,
              origin=CASE WHEN history_records.origin='direct' THEN 'direct' ELSE excluded.origin END`,[id,month,row.kind,upstream,JSON.stringify(row.payload),row.origin]);
        }
        if(m.followupCutoff) await stageFollowups(db,id,month,followups,m.followupCutoff);
        const count=Number((await db.query('SELECT count(*) AS n FROM history_records WHERE job_id=$1',[id])).rows[0].n);
        if(count>50000) throw codeError('BASE_ATINGIU_LIMITE_50000_REGISTROS');
        await db.query('UPDATE history_pages SET processed=true WHERE job_id=$1 AND day=$2 AND stream=$3 AND page=$4',[id,day,stream,page]);
        await db.query('UPDATE history_jobs SET attempts=0,error_code=NULL,updated_at=now() WHERE id=$1',[id]);
        await db.query('COMMIT');
      } catch(error) { await db.query('ROLLBACK'); throw error; }
      return historyStatus(db,id);
    }
    if(m.phase==='automatic'&&await automaticEnrichmentStep(db,client,job,month)) return historyStatus(db,id);
    await db.query("UPDATE history_jobs SET state='awaiting_validation',updated_at=now() WHERE id=$1 AND state='running'",[id]);
    return historyStatus(db,id);
  } catch(error) {
    if(!locked) throw error;
    const diagnostic=safeHubsoftDiagnostic(error);
    const diagnosticKey=`hubsoft_history_diagnostic:${id}`;
    if(diagnostic) await db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[diagnosticKey,JSON.stringify(diagnostic)]);
    else await db.query('DELETE FROM application_settings WHERE key=$1',[diagnosticKey]);
    const transient=['HUBSOFT_LIMITE_AGUARDE','HUBSOFT_FILA_OCUPADA','HUBSOFT_CONEXAO_OU_TIMEOUT','HUBSOFT_AUTENTICACAO'].includes(error.code)||/^HUBSOFT_HTTP_5/.test(error.code??'');
    const attempts=Number((await db.query('SELECT attempts FROM history_jobs WHERE id=$1',[id])).rows[0]?.attempts??0)+1;
    const retry=transient&&attempts<3;
    const code=/^[A-Z_0-9]{3,100}$/.test(error.code??'')?error.code:'CARGA_INTERROMPIDA';
    await db.query(`UPDATE history_jobs SET state=CASE WHEN state IN ('paused','cancelled') THEN state ELSE $2 END,
      error_code=$3,attempts=$4,next_at=$5,updated_at=now() WHERE id=$1`,[id,retry?'running':'paused',code,attempts,new Date(Math.max(error.retryAt??0,Date.now()+30000*attempts))]);
    return historyStatus(db,id);
  } finally { try {if(locked) await db.query('SELECT pg_advisory_unlock(73190602)');} finally {if(client.gate)client.gate.jobId=null;db.release();} }
}
export async function approveHistoryMonth(pool,id,evidence) {
  const db=await pool.connect(); let locked=false;
  try {
    locked=(await db.query('SELECT pg_try_advisory_lock(73190602) AS locked')).rows[0].locked;
    if(!locked) throw codeError('SINCRONIZACAO_EM_ANDAMENTO');
    await db.query('BEGIN');
    const job=(await db.query('SELECT * FROM history_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(job?.phase==='automatic') throw codeError('AUTOMACAO_USA_VALIDACAO_TECNICA');
    if(job?.state!=='awaiting_validation') throw codeError('CARGA_NAO_AGUARDA_VALIDACAO');
    const month=monthsFor(job.manifest)[job.month_index];
    if(evidence.month!==month || !evidence.reviewer || evidence.confirmFilters!==true) throw codeError('EVIDENCIA_INVALIDA');
    const discardedDrafts=await markCapturedDrafts(db,id,month);
    const rows=(await db.query('SELECT kind,upstream_id,payload FROM history_records WHERE job_id=$1 AND month=$2',[id,month])).rows;
    const reports=job.phase==='history'?job.manifest.monthReports[month]:job.manifest.reports;
    const incomplete=rows.filter(row=>row.kind==='attendance'&&row.payload.classification_status==='incomplete').length;
    if(incomplete&&evidence.confirmIncompleteRecords!==true) throw codeError('REVISAO_CAMPOS_INCOMPLETOS_OBRIGATORIA');
    const reportScopes={};
    for(const kind of ['attendance','serviceOrders']) {
      const supplied=evidence[kind];
      const comparison=compareHistoryReport(kind,rows.filter(row=>row.kind===kind),supplied,reports[kind]);
      if(comparison.ambiguous.length) throw codeError('IDENTIDADE_RELATORIO_AMBIGUA');
      if(comparison.blocker) throw codeError(comparison.blocker);
      if(comparison.status!=='matched') throw codeError('RECONCILIACAO_DIVERGENTE');
      if(comparison.commercialScope) reportScopes[kind]={
        reportSha256:reports[kind].fileSha256,rawStatus:comparison.rawStatus,
        expected:comparison.expected,actual:comparison.actual,missing:comparison.missing,
        commercialScope:comparison.commercialScope,
        ...(comparison.reportTypeReview?{reportTypeReview:comparison.reportTypeReview}:{}),
      };
      await upsertRows(db,kind,rows.filter(row=>row.kind===kind).map(row=>row.payload),'hubsoft');
    }
    const followup=job.manifest.followupCutoff ? await publishFollowups(db,id,month,job.manifest.followupCutoff,evidence.followup,reports.followup) : undefined;
    // Atualiza os indicadores somente na mesma transação da publicação aprovada.
    await rebuild(db);
    const done=job.month_index+1>=monthsFor(job.manifest).length;
    await db.query("UPDATE history_months SET state='published',reconciliation=$3::jsonb WHERE job_id=$1 AND month=$2",[id,month,JSON.stringify({reviewer:evidence.reviewer,at:new Date().toISOString(),...(followup ? {followup} : {}),...(Object.keys(reportScopes).length?{reportScopes}:{}),incompleteAttendances:incomplete,discardedDraftAttendances:discardedDrafts.length,confirmedIncompleteRecords:incomplete?evidence.confirmIncompleteRecords===true:false,attendance:rows.filter(r=>r.kind==='attendance').length,serviceOrders:rows.filter(r=>r.kind==='serviceOrders').length})]);
    await db.query("UPDATE history_jobs SET state=$2,approved=$3,month_index=month_index+1,next_at=now()+interval '5 minutes',error_code=NULL,updated_at=now() WHERE id=$1",[id,done?'complete':'running',done]);
    await db.query('COMMIT');
    return historyStatus(db,id);
  } catch(error) { await db.query('ROLLBACK'); throw error; }
  finally { try {if(locked) await db.query('SELECT pg_advisory_unlock(73190602)');} finally {db.release();} }
}

// Records explicit operator approval without starting the worker or clearing caches.
export function enablePilotProtocol(pool,id) { return enableProtocolException(pool,id,'day'); }
export function enableOctoberProtocol(pool,id) { return enableProtocolException(pool,id,'october'); }
export function enableHistoryProtocol(pool,id) { return enableProtocolException(pool,id,'history'); }
async function enableProtocolException(pool,id,phase) {
  if(phase==='october'&&id!==OCTOBER_PROTOCOL_JOB_ID) throw codeError('EXCECAO_PROTOCOLO_FORA_DE_OUTUBRO');
  const db=await pool.connect();let locked=false;
  try {
    locked=(await db.query('SELECT pg_try_advisory_lock(73190602) AS locked')).rows[0].locked;
    if(!locked) throw codeError('SINCRONIZACAO_EM_ANDAMENTO');
    await db.query('BEGIN');
    const job=(await db.query('SELECT * FROM history_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];
    const allowedState=phase==='history'?['planned','paused'].includes(job?.state):job?.state==='paused';
    if(!allowedState||job.phase!==phase||(phase==='day'&&job.manifest.peakDay!=='2026-10-01')) throw codeError('ESTADO_NAO_PERMITE_EXCECAO');
    if(job.manifest.enrichmentStrategy!=='protocol'&&job.state!=='planned'&&job.error_code!=='HUBSOFT_ATENDIMENTO_NAO_RESOLVIDO') throw codeError('ERRO_NAO_PERMITE_EXCECAO');
    const scope=phase==='day'?{day:job.manifest.peakDay}:phase==='history'?{months:monthsFor(job.manifest),cutoff:job.manifest.cutoff}:{month:'2026-10'};
    const manifest={...job.manifest,enrichmentStrategy:'protocol',protocolException:{enabled:true,jobId:id,...scope,authorizedAt:new Date().toISOString()}};
    validateManifest(manifest);
    usesProtocolPilot(manifest,id);
    await db.query('UPDATE history_jobs SET manifest=$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(manifest)]);
    await db.query('COMMIT');
    return await historyStatus(db,id);
  } catch(error) {await db.query('ROLLBACK');throw error;}
  finally {try{if(locked)await db.query('SELECT pg_advisory_unlock(73190602)');}finally{db.release();}}
}
