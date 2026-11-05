import {createHash} from 'node:crypto';
import {exactId,localDay,OCTOBER_PROTOCOL_JOB_ID} from './historyPolicy.mjs';
import {normalizeHubsoft} from './hubsoftAdapter.mjs';
import {rebuild,upsertRows} from './records.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const key=(scope,target)=>`hubsoft_installation_context:${scope.jobId}:${target.orderId}:${target.attendanceId}`;
const signature=order=>createHash('sha256').update(JSON.stringify([
  order.id_ordem_servico,order.numero_ordem_servico,order.id_atendimento,order.codigo_cliente,
  order.tipo_ordem_servico,order.status,order.data_inicio_executado,order.data_termino_executado,
])).digest('hex');
function executionStamp(value) {
  const day=localDay(value,true);
  const time=String(value).split(' ')[1];
  return `${day}T${time.length===5?`${time}:00`:time}`;
}

export function validateInstallationContextScope(input) {
  if(input?.version!==1||input.jobId!==OCTOBER_PROTOCOL_JOB_ID||input.month!=='2026-10'||
    input.openingMonth!=='2026-09'||!Array.isArray(input.targets)||!input.targets.length||input.targets.length>3)
    return fail('ESCOPO_CONTEXTO_INVALIDO');
  const orders=new Set(),parents=new Set(),protocols=new Set();
  for(const target of input.targets) {
    for(const field of ['orderId','orderNumber','attendanceId','protocol']) {
      if(typeof target?.[field]!=='string') return fail('ESCOPO_CONTEXTO_INVALIDO');
      exactId(target[field]);
    }
    if(orders.has(target.orderId)||parents.has(target.attendanceId)||protocols.has(target.protocol)) return fail('CONTEXTO_IDENTIDADE_DUPLICADA');
    orders.add(target.orderId);parents.add(target.attendanceId);protocols.add(target.protocol);
  }
  return input;
}

async function withLock(pool,work) {
  const db=await pool.connect();let locked=false;
  try {
    locked=(await db.query('SELECT pg_try_advisory_lock(73190602) AS locked')).rows[0].locked;
    if(!locked) return fail('SINCRONIZACAO_EM_ANDAMENTO');
    return await work(db);
  } finally {try {if(locked)await db.query('SELECT pg_advisory_unlock(73190602)');} finally {db.release();}}
}

async function loadOrders(db,scope) {
  const job=(await db.query(`SELECT j.phase,j.state,j.approved,j.manifest,m.state AS month_state
    FROM history_jobs j JOIN history_months m ON m.job_id=j.id AND m.month=$2 WHERE j.id=$1`,[scope.jobId,scope.month])).rows[0];
  if(job?.phase!=='october'||job.state!=='complete'||!job.approved||job.month_state!=='published'||
    job.manifest.osDateField!=='data_termino_executado'||job.manifest.cutoff!=='2026-10-31') return fail('OUTUBRO_PUBLICADO_OBRIGATORIO');
  const result=[];
  for(const target of scope.targets) {
    const saved=(await db.query(`SELECT s.payload FROM source_records s
      JOIN history_records h ON h.kind=s.kind AND h.upstream_id=$2 AND h.job_id=$1 AND h.month=$3
      WHERE s.kind='serviceOrders' AND s.id=$4
      AND COALESCE(s.payload->>'publication_scope','published')='published'`,
    [scope.jobId,target.orderId,scope.month,`hubsoft:${target.orderId}`])).rows;
    if(saved.length!==1) return fail('OS_PUBLICADA_NAO_ENCONTRADA');
    const order=saved[0].payload;
    if(exactId(order.id_ordem_servico)!==target.orderId||exactId(order.numero_ordem_servico)!==target.orderNumber||
      exactId(order.id_atendimento)!==target.attendanceId||norm(order.tipo_ordem_servico)!=='instalacao'||
      norm(order.status)!=='finalizado') return fail('CONTEXTO_OS_DIVERGENTE');
    exactId(order.codigo_cliente);
    const start=executionStamp(order.data_inicio_executado),end=executionStamp(order.data_termino_executado);
    if(start>end||end.slice(0,7)!==scope.month) return fail('CONTEXTO_EXECUCAO_INVALIDA');
    result.push({target,order,fingerprint:signature(order)});
  }
  return result;
}

function validateAttendance(record,scope,{target,order}) {
  if(record?.deleted_at) return fail('CONTEXTO_ATENDIMENTO_EXCLUIDO');
  if(record?.classification_status) return fail('CONTEXTO_ATENDIMENTO_INVALIDO');
  const normalized=normalizeHubsoft('attendance',record);
  if(exactId(normalized.id_atendimento)!==target.attendanceId||normalized.protocolo!==target.protocol||
    exactId(normalized.codigo_cliente)!==exactId(order.codigo_cliente)) return fail('CONTEXTO_ATENDIMENTO_DIVERGENTE');
  const opened=localDay(normalized.data_cadastro);
  if(opened.slice(0,7)!==scope.openingMonth||opened>localDay(order.data_inicio_executado,true)||
    norm(normalized.tipo_atendimento)!=='instalacao'||normalized.classification_status) return fail('CONTEXTO_ATENDIMENTO_INVALIDO');
  // Preserve actual day precision without manufacturing a time of opening.
  return {...normalized,data_cadastro:normalized.data_cadastro.split(' ')[0],date_precision:'day'};
}
function validCache(value,scope,entry) {
  if(!value||value.orderFingerprint!==entry.fingerprint||value.protocol!==entry.target.protocol||
    value.jobId!==scope.jobId||value.orderId!==entry.target.orderId) return fail('CONTEXTO_CACHE_DIVERGENTE');
  return validateAttendance(value.record,scope,entry);
}
function summary(scope,entries) {
  return {jobId:scope.jobId,month:scope.month,openingMonth:scope.openingMonth,maximumDetailQueries:entries.length,
    targets:entries.map(({target:{orderId,orderNumber,attendanceId,protocol}})=>({orderId,orderNumber,attendanceId,protocol})),published:false};
}

export async function planInstallationContext(pool,input) {
  const scope=validateInstallationContextScope(input);
  return withLock(pool,async db=>summary(scope,await loadOrders(db,scope)));
}

export async function captureInstallationContext(pool,client,input,env=process.env) {
  const scope=validateInstallationContextScope(input);
  if(env.HUBSOFT_HISTORY_ENABLED!=='true'||env.HUBSOFT_HISTORY_IP_COORDINATED!=='true') return fail('CARGA_HISTORICA_DESATIVADA');
  if(client.gate?.interval!==1000) return fail('CONTEXTO_EXIGE_GATE_1_REQ_S');
  return withLock(pool,async db=>{
    const entries=await loadOrders(db,scope);let requested=0,reused=0;
    // Reuse the approved job's accumulated budget and the shared token/gate.
    client.gate.jobId=scope.jobId;
    for(const entry of entries) {
      const cache=(await db.query('SELECT value FROM application_settings WHERE key=$1',[key(scope,entry.target)])).rows[0]?.value;
      if(cache) {validCache(cache,scope,entry);reused++;continue;}
      const detail=await client.attendanceDetail(entry.target.protocol);requested++;
      const record=validateAttendance(detail,scope,entry);
      const value={jobId:scope.jobId,orderId:entry.target.orderId,protocol:entry.target.protocol,
        orderFingerprint:entry.fingerprint,observedAt:new Date().toISOString(),record};
      await db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb)',[key(scope,entry.target),JSON.stringify(value)]);
    }
    return {...summary(scope,entries),ready:true,detailQueries:requested,reused,
      message:'Contextos validados e salvos para revisao; indicadores ainda nao alterados.'};
  });
}

export async function applyInstallationContext(pool,input,env=process.env) {
  const scope=validateInstallationContextScope(input);
  if(env.HUBSOFT_HISTORY_ENABLED!=='true'||env.HUBSOFT_HISTORY_IP_COORDINATED!=='true') return fail('CARGA_HISTORICA_DESATIVADA');
  return withLock(pool,async db=>{
    await db.query('BEGIN');
    try {
      const entries=await loadOrders(db,scope);let applied=0;
      for(const entry of entries) {
        const cache=(await db.query('SELECT value FROM application_settings WHERE key=$1',[key(scope,entry.target)])).rows[0]?.value;
        const record=validCache(cache,scope,entry);
        const existing=(await db.query("SELECT payload FROM source_records WHERE kind='attendance' AND id=$1",[`hubsoft:${entry.target.attendanceId}`])).rows[0]?.payload;
        if(existing&&!["manual_staging","installation_context"].includes(existing.publication_scope??'published')) {
          validateAttendance(existing,scope,entry);continue;
        }
        const bindings=new Set([entry.target.orderId]);
        if(existing?.publication_scope==='installation_context') {
          validateAttendance(existing,scope,entry);
          for(const id of String(existing.installation_context_order_ids??'').split(',').filter(Boolean)) bindings.add(exactId(id));
        }
        await upsertRows(db,'attendance',[{...record,publication_scope:'installation_context',
          installation_context_order_ids:[...bindings].sort().join(','),context_job_id:scope.jobId,
          context_observed_at:cache.observedAt}],'hubsoft');
        applied++;
      }
      const result=await rebuild(db);
      const metrics=(await db.query(`SELECT kind,count(*)::int AS records FROM commercial_records
        WHERE event_date >= '2026-10-01 00:00:00-03'::timestamptz AND event_date < '2026-11-01 00:00:00-03'::timestamptz GROUP BY kind ORDER BY kind`)).rows;
      await db.query('COMMIT');
      return {jobId:scope.jobId,month:scope.month,contexts:applied,...result,metrics};
    } catch(error) {await db.query('ROLLBACK');throw error;}
  });
}
