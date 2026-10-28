import { randomUUID } from 'node:crypto';
import { validateManifest,monthsFor,daysFor,exactId,localDay,assertContractRecord,nextWindowAt } from './historyPolicy.mjs';
import { normalizeHubsoft } from './hubsoftAdapter.mjs';
import { upsertRows,rebuild } from './records.mjs';
import { projectHistoryRecord } from './historyProjection.mjs';
const codeError=code=>Object.assign(new Error(code),{code});
const streams=['attendance','attendanceChanges','serviceOrders','serviceOrderCompletions'];

export async function createHistoryJob(db,manifest) {
  validateManifest(manifest);
  if(manifest.phase==='history') {
    const parent=(await db.query("SELECT * FROM history_jobs WHERE id=$1 AND phase='october' AND approved AND state='complete'",[manifest.approvedOctoberJob])).rows[0];
    if(!parent || parent.manifest.osDateField!==manifest.osDateField) throw codeError('PILOTO_OUTUBRO_OBRIGATORIO');
  }
  if(manifest.phase==='october') {
    const parent=(await db.query("SELECT id,manifest FROM history_jobs WHERE id=$1 AND phase='day' AND approved AND state='complete'",[manifest.approvedDayJob])).rows[0];
    if(!parent || parent.manifest.osDateField!==manifest.osDateField) throw codeError('PILOTO_DIARIO_OBRIGATORIO');
  }
  const id=randomUUID();
  await db.query('INSERT INTO history_jobs(id,phase,manifest) VALUES($1,$2,$3::jsonb)',[id,manifest.phase,JSON.stringify(manifest)]);
  if(manifest.phase==='history') await db.query('UPDATE history_jobs SET next_at=GREATEST(next_at,(SELECT next_at FROM history_jobs WHERE id=$2)) WHERE id=$1',[id,manifest.approvedOctoberJob]);
  return id;
}
export async function historyStatus(db,id) {
  const job=(await db.query('SELECT id,phase,state,month_index,next_at,error_code,approved FROM history_jobs WHERE id=$1',[id])).rows[0];
  if(!job) throw codeError('CARGA_NAO_ENCONTRADA');
  const totals=(await db.query('SELECT kind,count(*)::int AS unique_records FROM history_records WHERE job_id=$1 GROUP BY kind',[id])).rows;
  const pages=(await db.query('SELECT count(*)::int AS pages,count(*) FILTER(WHERE processed)::int AS processed FROM history_pages WHERE job_id=$1',[id])).rows[0];
  const calls=(await db.query(`SELECT count(*)::int AS calls,count(*) FILTER(WHERE status=429)::int AS rate_limited,
    count(*) FILTER(WHERE method='POST')::int AS oauth_calls,avg(latency_ms) AS latency_avg_ms,
    max(latency_ms) AS latency_max_ms,percentile_cont(0.95) WITHIN GROUP(ORDER BY latency_ms) AS latency_p95_ms FROM hubsoft_call_metrics WHERE job_id=$1`,[id])).rows[0];
  return {...job,totals,pages,calls};
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
function clientCode(raw) { return raw.cliente?.codigo_cliente??raw.cliente_servico?.cliente?.codigo_cliente??raw.codigo_cliente; }
function normalized(kind,raw) {
  const row=normalizeHubsoft(kind,raw);
  if(kind==='attendance') { row.data_cadastro=row.data_cadastro.split(' ')[0]; row.date_precision='day'; }
  assertContractRecord(kind,row);
  return row;
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
    if(!month) return historyStatus(db,id);
    const windowAt=nextWindowAt(m.window);
    if(windowAt>Date.now()+1000) {await db.query('UPDATE history_jobs SET next_at=$2 WHERE id=$1',[id,new Date(windowAt)]);return historyStatus(db,id);}
    if(client.gate) client.gate.jobId=id;
    const calls=Number((await db.query('SELECT count(*) AS n FROM hubsoft_call_metrics WHERE job_id=$1',[id])).rows[0].n);
    if(calls>=m.maxCalls) throw codeError('ORCAMENTO_ATINGIDO');
    await db.query('INSERT INTO history_months(job_id,month) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,month]);
    for(const day of daysFor(m,month)) for(const stream of streams) {
      const kind=stream.startsWith('attendance')?'attendance':'serviceOrders';
      const saved=(await db.query('SELECT * FROM history_pages WHERE job_id=$1 AND day=$2 AND stream=$3 ORDER BY page DESC LIMIT 1',[id,day,stream])).rows[0];
      if(saved?.processed && saved.complete) continue;
      const page=saved&&!saved.processed?saved.page:(saved?.page??-1)+1;
      let current=saved&&!saved.processed?saved:null;
      if(!current) {
        // Os filtros do manifesto são cobertura de cadastro/programação/conclusão explícita.
        const result=await client.page(stream,day,page,stream==='serviceOrders'?m.osDateField:undefined);
        await db.query('INSERT INTO history_pages(job_id,day,stream,page,records,complete) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[id,day,stream,page,JSON.stringify(result.records.map(r=>projectHistoryRecord(r))),result.complete]);
        return historyStatus(db,id);
      }
      const rows=[];
      for(const raw of current.records) {
        const rawDate=kind==='attendance'?(raw.data_cadastro_br??raw.data_cadastro):raw[m.osDateField];
        if(rawDate) {const date=localDay(normalizeDate(rawDate));if(date.slice(0,7)!==month||date>m.cutoff)continue;}
        if(raw.deleted_at) throw codeError('EXCLUSAO_EXIGE_RECONCILIACAO');
        let row;
        try { row=normalized(kind,raw); }
        catch(error) {
          if(kind!=='attendance'||!error.diagnostic?.missingFields?.includes('usuario_abertura')) throw error;
          const customer=exactId(clientCode(raw));
          // Consultar pelo dia de abertura, não pelo dia em que houve alteração.
          const created=localDay(normalizeDate(raw.data_cadastro_br??raw.data_cadastro));
          if(!created.startsWith('2026-')||created>m.cutoff) continue;
          let cache=(await db.query('SELECT records FROM history_clients WHERE job_id=$1 AND client_code=$2 AND day=$3',[id,customer,created])).rows[0];
          if(!cache) {
            const response=await client.clientAttendances(customer,created);
            await db.query('INSERT INTO history_clients(job_id,client_code,day,records) VALUES($1,$2,$3,$4::jsonb)',[id,customer,created,JSON.stringify(response.map(r=>projectHistoryRecord(r)))]);
            return historyStatus(db,id);
          }
          const match=cache.records.filter(item=>String(item.id_atendimento)===exactId(raw.id_atendimento));
          if(match.length!==1) throw codeError('HUBSOFT_ATENDIMENTO_NAO_RESOLVIDO');
          row=normalized(kind,{...raw,usuario_abertura:match[0].usuario_abertura});
          // OS da consulta por cliente também passam pela mesma chave canônica.
          for(const os of match[0].ordens_servico??[]) rows.push({kind:'serviceOrders',payload:normalized('serviceOrders',{...os,cliente:os.cliente??raw.cliente??raw.cliente_servico?.cliente,atendimento:{id_atendimento:raw.id_atendimento}}),origin:'embedded'});
        }
        rows.push({kind,payload:row,origin:'direct'});
        if(kind==='attendance') for(const os of raw.ordens_servico??[]) rows.push({kind:'serviceOrders',payload:normalized('serviceOrders',{...os,cliente:os.cliente??raw.cliente??raw.cliente_servico?.cliente,atendimento:{id_atendimento:raw.id_atendimento}}),origin:'embedded'});
      }
      await db.query('BEGIN');
      try {
        // Um pedido de pausa durante a chamada não descarta a página recebida.
        for(const row of rows) {
          const date=businessDay(row.kind,row.payload,m);
          if(date.slice(0,7)!==month||date>m.cutoff) continue;
          const upstream=exactId(row.payload[row.kind==='attendance'?'id_atendimento':'id_ordem_servico']);
          await db.query(`INSERT INTO history_records(job_id,month,kind,upstream_id,payload,origin) VALUES($1,$2,$3,$4,$5::jsonb,$6)
            ON CONFLICT(job_id,kind,upstream_id) DO UPDATE SET payload=CASE
              WHEN history_records.origin='direct' AND excluded.origin='embedded' THEN history_records.payload ELSE excluded.payload END,
              origin=CASE WHEN history_records.origin='direct' THEN 'direct' ELSE excluded.origin END`,[id,month,row.kind,upstream,JSON.stringify(row.payload),row.origin]);
        }
        const count=Number((await db.query('SELECT count(*) AS n FROM history_records WHERE job_id=$1',[id])).rows[0].n);
        if(count>50000) throw codeError('BASE_ATINGIU_LIMITE_50000_REGISTROS');
        await db.query('UPDATE history_pages SET processed=true WHERE job_id=$1 AND day=$2 AND stream=$3 AND page=$4',[id,day,stream,page]);
        await db.query('UPDATE history_jobs SET attempts=0,error_code=NULL,updated_at=now() WHERE id=$1',[id]);
        await db.query('COMMIT');
      } catch(error) { await db.query('ROLLBACK'); throw error; }
      return historyStatus(db,id);
    }
    await db.query("UPDATE history_jobs SET state='awaiting_validation',updated_at=now() WHERE id=$1 AND state='running'",[id]);
    return historyStatus(db,id);
  } catch(error) {
    if(!locked) throw error;
    const transient=['HUBSOFT_LIMITE_AGUARDE','HUBSOFT_FILA_OCUPADA','HUBSOFT_CONEXAO_OU_TIMEOUT','HUBSOFT_AUTENTICACAO'].includes(error.code)||/^HUBSOFT_HTTP_5/.test(error.code??'');
    const attempts=Number((await db.query('SELECT attempts FROM history_jobs WHERE id=$1',[id])).rows[0]?.attempts??0)+1;
    const retry=transient&&attempts<3;
    const code=/^[A-Z_0-9]{3,100}$/.test(error.code??'')?error.code:'CARGA_INTERROMPIDA';
    await db.query(`UPDATE history_jobs SET state=CASE WHEN state IN ('paused','cancelled') THEN state ELSE $2 END,
      error_code=$3,attempts=$4,next_at=$5,updated_at=now() WHERE id=$1`,[id,retry?'running':'paused',code,attempts,new Date(Math.max(error.retryAt??0,Date.now()+30000*attempts))]);
    return historyStatus(db,id);
  } finally { try {if(locked) await db.query('SELECT pg_advisory_unlock(73190602)');} finally {if(client.gate)client.gate.jobId=null;db.release();} }
}
function normalizeDate(value) {
  if(/^\d{4}-\d{2}-\d{2}/.test(String(value))) { const [y,m,d]=value.slice(0,10).split('-'); return `${d}/${m}/${y}`; }
  return value;
}
export async function approveHistoryMonth(pool,id,evidence) {
  const db=await pool.connect(); let locked=false;
  try {
    locked=(await db.query('SELECT pg_try_advisory_lock(73190602) AS locked')).rows[0].locked;
    if(!locked) throw codeError('SINCRONIZACAO_EM_ANDAMENTO');
    await db.query('BEGIN');
    const job=(await db.query('SELECT * FROM history_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(job?.state!=='awaiting_validation') throw codeError('CARGA_NAO_AGUARDA_VALIDACAO');
    const month=monthsFor(job.manifest)[job.month_index];
    if(evidence.month!==month || !evidence.reviewer || evidence.confirmFilters!==true) throw codeError('EVIDENCIA_INVALIDA');
    const rows=(await db.query('SELECT kind,upstream_id,payload FROM history_records WHERE job_id=$1 AND month=$2',[id,month])).rows;
    const reports=job.phase==='history'?job.manifest.monthReports[month]:job.manifest.reports;
    for(const kind of ['attendance','serviceOrders']) {
      const supplied=evidence[kind];
      if(!supplied||supplied.reportSha256!==reports[kind].fileSha256||!Array.isArray(supplied.ids)) throw codeError('EVIDENCIA_INVALIDA');
      const actual=new Set(rows.filter(row=>row.kind===kind).map(row=>row.upstream_id));
      const expected=new Set(supplied.ids.map(exactId));
      if(actual.size!==expected.size||[...actual].some(key=>!expected.has(key))) throw codeError('RECONCILIACAO_DIVERGENTE');
      await upsertRows(db,kind,rows.filter(row=>row.kind===kind).map(row=>row.payload),'hubsoft');
    }
    // Atualiza os indicadores somente na mesma transação da publicação aprovada.
    await rebuild(db);
    const done=job.month_index+1>=monthsFor(job.manifest).length;
    await db.query("UPDATE history_months SET state='published',reconciliation=$3::jsonb WHERE job_id=$1 AND month=$2",[id,month,JSON.stringify({reviewer:evidence.reviewer,at:new Date().toISOString(),attendance:rows.filter(r=>r.kind==='attendance').length,serviceOrders:rows.filter(r=>r.kind==='serviceOrders').length})]);
    await db.query("UPDATE history_jobs SET state=$2,approved=$3,month_index=month_index+1,next_at=now()+interval '5 minutes',error_code=NULL,updated_at=now() WHERE id=$1",[id,done?'complete':'running',done]);
    await db.query('COMMIT');
    return historyStatus(db,id);
  } catch(error) { await db.query('ROLLBACK'); throw error; }
  finally { try {if(locked) await db.query('SELECT pg_advisory_unlock(73190602)');} finally {db.release();} }
}
