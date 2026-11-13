import {createHash} from 'node:crypto';
import {canonicalLocation} from '../server-dist/commercial.js';
import {exactId,localDay} from './historyPolicy.mjs';
import {clientCode,normalizedAttendanceDetail} from './historyNormalization.mjs';
import {orderDate} from './historyFollowup.mjs';
import {extractLocationFields,serviceIdentity} from './locationFields.mjs';
import {locationRepairMonths} from './locationRecovery.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const MAX_CALLS=500;
const LOOKUP_VERSION='all_customer_statuses_v1';
const pendingKey=target=>`location_service_pending:${target.month}:${target.id}`;
const key=target=>`location_service_evidence:${target.month}:${target.id}`;
const identityKey=target=>`location_service_identity:${target.month}:${target.id}`;
const activeMissKey=target=>`location_service_active_miss:${target.month}:${target.id}`;
const budgetKey=months=>`location_service_budget:v1:${months.join(',')}`;
function stable(value) {
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
const digest=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
function signature(target) {
  const {location:_location,...sale}=target.sale;
  return digest({sale,attendance:target.attendance,order:target.order});
}
async function targets(db,months) {
  const rows=(await db.query(`SELECT c.id,c.payload AS sale,
    to_char(c.event_date AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') AS month,
    a.payload AS attendance,o.payload AS "order"
    FROM commercial_records c
    LEFT JOIN source_records a ON a.kind='attendance' AND a.id=c.payload->>'attendanceId'
    LEFT JOIN source_records o ON o.kind='serviceOrders' AND o.id=c.payload->>'id'
    WHERE c.kind='sales' AND to_char(c.event_date AT TIME ZONE 'America/Sao_Paulo','YYYY-MM')=ANY($1::text[])
    ORDER BY c.id`,[months])).rows;
  return rows.filter(row=>!canonicalLocation(row.sale.location));
}
function validateTarget(target) {
  const {attendance:a,order:o,sale}=target;
  if(!a||!o||a.classification_status||o.classification_status)fail('LOCALIDADE_FONTE_INDISPONIVEL');
  if(sale.attendanceId!==`hubsoft:${exactId(a.id_atendimento)}`||sale.id!==`hubsoft:${exactId(o.id_ordem_servico)}`||
    exactId(o.id_atendimento)!==exactId(a.id_atendimento)||exactId(a.codigo_cliente)!==exactId(o.codigo_cliente))fail('LOCALIDADE_VINCULO_DIVERGENTE');
  exactId(a.protocolo);exactId(o.numero_ordem_servico);
  const opened=localDay(a.data_cadastro),started=localDay(o.data_inicio_executado,true),finished=localDay(o.data_termino_executado,true);
  const type=String(o.tipo_ordem_servico).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(opened<'2025-01-01'||started<opened||finished<started||finished.slice(0,7)!==target.month||
    o.data_referencia_bi!=='data_termino_executado'||!/\binstalacao\b/.test(type)||/check[\s-]*list/.test(type)||
    String(o.status).trim().toLowerCase()!=='finalizado')fail('LOCALIDADE_EXECUCAO_DIVERGENTE');
}
function checkedEvidence(target,evidence) {
  if(!evidence||evidence.fingerprint!==signature(target)||!evidence.observedAt||
    !canonicalLocation(evidence.bairro,evidence.cidade)||!serviceIdentity(evidence))fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
  const current=serviceIdentity(target.order)||serviceIdentity(target.attendance);
  if(current&&current!==evidence.id_cliente_servico)fail('HUBSOFT_SERVICO_DIVERGENTE');
  return evidence;
}
function checkedPending(target,pending) {
  if(!pending||pending.lookupVersion!==LOOKUP_VERSION||pending.code!=='LOCALIDADE_SERVICO_NAO_ENCONTRADO'||
    pending.fingerprint!==signature(target)||!pending.observedAt||!serviceIdentity(pending))fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
  const id=serviceIdentity(target.order)||serviceIdentity(target.attendance);
  if(id&&id!==pending.id_cliente_servico)fail('HUBSOFT_SERVICO_DIVERGENTE');
  return pending;
}
async function cache(db,list) {
  if(!list.length)return new Map();
  return new Map((await db.query('SELECT key,value FROM application_settings WHERE key=ANY($1::text[])',[list.flatMap(target=>[key(target),identityKey(target),activeMissKey(target),pendingKey(target)])])).rows.map(row=>[row.key,row.value]));
}
async function withLock(pool,work) {
  const db=await pool.connect();let locked=false;
  try {
    locked=(await db.query('SELECT pg_try_advisory_lock(73190602) AS locked')).rows[0].locked;
    if(!locked)fail('SINCRONIZACAO_EM_ANDAMENTO');
    return await work(db);
  }finally{try{if(locked)await db.query('SELECT pg_advisory_unlock(73190602)');}finally{db.release();}}
}
export async function planServiceLocations(db,scope) {
  const months=locationRepairMonths(scope),list=await targets(db,months),saved=await cache(db,list);
  let ready=0,invalid=0,unresolved=0;const byLocation=new Map(),byReason=new Map();
  for(const target of list)try{
    validateTarget(target);
    if(saved.has(key(target))){
      const evidence=checkedEvidence(target,saved.get(key(target))),location=canonicalLocation(evidence.bairro,evidence.cidade);
      ready++;byLocation.set(location,(byLocation.get(location)??0)+1);
    }else if(saved.has(pendingKey(target))){
      const pending=checkedPending(target,saved.get(pendingKey(target)));unresolved++;
      byReason.set(pending.code,(byReason.get(pending.code)??0)+1);
    }
  }catch{invalid++;}
  const used=(await db.query('SELECT value FROM application_settings WHERE key=$1',[budgetKey(months)])).rows[0]?.value?.used??0;
  return {months,missingSales:list.length,readyForReview:ready,readyByLocation:[...byLocation].map(([location,sales])=>({location,sales})),invalidEvidenceOrSource:invalid,
    unresolvedSales:unresolved,unresolvedByReason:[...byReason].map(([code,sales])=>({code,sales})),
    uncaptured:list.length-ready-invalid-unresolved,maximumCalls:MAX_CALLS,callsReserved:used,
    addressBasis:'current_installation_address_of_exact_service',published:false};
}
function checkedDetail(target,detail) {
  const a=target.attendance,o=target.order;
  normalizedAttendanceDetail(a,detail,exactId(a.codigo_cliente),localDay(a.data_cadastro));
  const orders=detail.ordens_servico;
  if(!Array.isArray(orders)||orders.length>50)fail('LOCALIDADE_OS_NAO_CONFIRMADA');
  const linked=orders.filter(row=>String(row.id_ordem_servico)===String(o.id_ordem_servico));
  if(linked.length!==1)fail('LOCALIDADE_OS_NAO_CONFIRMADA');
  const observed=linked[0];
  const status=String(observed.status?.descricao??observed.status?.nome??observed.status??'').trim().toLowerCase();
  const rawType=observed.tipo??observed.tipo_ordem_servico;
  const type=String(rawType?.descricao??rawType?.nome??rawType??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(observed.deleted_at||status!=='finalizado'||!/\binstalacao\b/.test(type)||/check[\s-]*list/.test(type))fail('LOCALIDADE_OS_DIVERGENTE');
  if(exactId(observed.numero_ordem_servico??observed.numero)!==exactId(o.numero_ordem_servico)||
    (observed.id_atendimento!=null&&exactId(observed.id_atendimento)!==exactId(a.id_atendimento))||
    (clientCode(observed)!=null&&exactId(clientCode(observed))!==exactId(a.codigo_cliente))||
    !sameExecution(o.data_inicio_executado,observed.data_inicio_executado)||
    !sameExecution(o.data_termino_executado,observed.data_termino_executado))fail('LOCALIDADE_OS_DIVERGENTE');
  const ids=[serviceIdentity(detail),serviceIdentity(observed),serviceIdentity(o),serviceIdentity(a)].filter(Boolean);
  if(!ids.length)fail('LOCALIDADE_SERVICO_NAO_IDENTIFICADO');
  if(new Set(ids).size!==1)fail('HUBSOFT_SERVICO_DIVERGENTE');
  return ids[0];
}
function sameExecution(stored,observed) {
  const expected=orderDate(stored),actual=orderDate(observed);
  return expected.length===16?actual.slice(0,16)===expected:actual===expected;
}
export async function captureServiceLocations(pool,client,scope,{maxCalls=4,retryUnresolved=false,env=process.env}={}) {
  const months=locationRepairMonths(scope);
  if(!Number.isInteger(maxCalls)||maxCalls<4||maxCalls>100||typeof retryUnresolved!=='boolean')fail('LOCALIDADE_ORCAMENTO_INVALIDO');
  if(env.HUBSOFT_HISTORY_IP_COORDINATED!=='true'||!(env.HUBSOFT_AUTOMATIC_ENABLED==='true'||env.HUBSOFT_HISTORY_ENABLED==='true')||
    client.gate?.interval!==1000)fail('LOCALIDADE_EXIGE_GATE_COORDENADO_1_REQ_S');
  return withLock(pool,async db=>{
    const originalGate=client.gate;let calls=0,captured=0,reused=0,unresolved=0;
    const savedBudget=(await db.query('SELECT value FROM application_settings WHERE key=$1',[budgetKey(months)])).rows[0]?.value;
    let used=Number(savedBudget?.used??0);
    if(!Number.isInteger(used)||used<0||used>MAX_CALLS)fail('LOCALIDADE_ORCAMENTO_INVALIDO');
    const save=(name,value)=>db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[name,JSON.stringify(value)]);
    // The shared gate still coordinates OAuth, rate, cooldown and token. Reserve before transport, including failed calls.
    client.gate={interval:originalGate.interval,token:work=>originalGate.token(work),invalidateToken:()=>originalGate.invalidateToken(),
      perform:(meta,send)=>originalGate.perform(meta,async()=>{
        if(calls>=maxCalls||used>=MAX_CALLS)fail('LOCALIDADE_ORCAMENTO_ATINGIDO');
        calls++;used++;await save(budgetKey(months),{used,maximum:MAX_CALLS,updatedAt:new Date().toISOString()});
        return send();
      })};
    try {
      const list=await targets(db,months),saved=await cache(db,list);
      for(const target of list) {
        validateTarget(target);
        if(saved.has(key(target))){checkedEvidence(target,saved.get(key(target)));reused++;continue;}
        const pending=saved.get(pendingKey(target));
        if(pending){
          checkedPending(target,pending);
          if(!retryUnresolved){unresolved++;continue;}
        }
        if(maxCalls-calls<4)break;
        // One protocol plus two client-status queries and a possible OAuth call fit the four-call reservation.
        let identity=saved.get(identityKey(target));
        if(identity) {
          if(identity.fingerprint!==signature(target)||!serviceIdentity(identity))fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
        } else {
          const detail=await client.attendanceDetail(exactId(target.attendance.protocolo));
          identity={fingerprint:signature(target),id_cliente_servico:checkedDetail(target,detail),observedAt:new Date().toISOString()};
          await save(identityKey(target),identity);
        }
        const id=identity.id_cliente_servico,customer=exactId(target.attendance.codigo_cliente);
        const activeMiss=saved.get(activeMissKey(target));
        if(activeMiss&&(activeMiss.fingerprint!==signature(target)||activeMiss.id_cliente_servico!==id))fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
        // An old miss used the active-customer default and cannot exclude the new all-status lookup.
        const reuseMiss=activeMiss?.lookupVersion===LOOKUP_VERSION&&!pending;
        let services=reuseMiss?[]:await client.clientInstallationServices(customer,false);
        let matches=services.filter(service=>service.id_cliente_servico===id);
        if(!matches.length){
          if(!reuseMiss)await save(activeMissKey(target),{lookupVersion:LOOKUP_VERSION,fingerprint:signature(target),id_cliente_servico:id,observedAt:new Date().toISOString()});
          services=await client.clientInstallationServices(customer,true);matches=services.filter(service=>service.id_cliente_servico===id);
        }
        if(!matches.length){
          await save(pendingKey(target),{lookupVersion:LOOKUP_VERSION,code:'LOCALIDADE_SERVICO_NAO_ENCONTRADO',
            fingerprint:signature(target),id_cliente_servico:id,observedAt:new Date().toISOString()});
          unresolved++;continue;
        }
        if(matches.length!==1)fail('HUBSOFT_SERVICOS_INVALIDOS');
        const {bairro,cidade}=extractLocationFields(matches[0]);
        if(!canonicalLocation(bairro,cidade))fail('LOCALIDADE_ENDERECO_NAO_RETORNADO');
        const evidence={version:1,fingerprint:signature(target),id_cliente_servico:id,bairro,cidade,
          observedAt:new Date().toISOString(),source:'hubsoft_exact_service_current_installation_address'};
        await save(key(target),evidence);
        if(pending)await db.query('DELETE FROM application_settings WHERE key=$1',[pendingKey(target)]);
        captured++;
      }
      return {months,captured,reused,unresolvedSales:unresolved,callsThisRun:calls,callsReserved:used,maximumCalls:MAX_CALLS,published:false};
    }finally{client.gate=originalGate;}
  });
}
export async function applyServiceLocations(pool,scope,{acceptCurrentServiceAddress=false}={}) {
  const months=locationRepairMonths(scope);
  if(!acceptCurrentServiceAddress)fail('LOCALIDADE_REVISAO_ENDERECO_ATUAL_OBRIGATORIA');
  return withLock(pool,async db=>{
    await db.query('BEGIN');
    try {
      const list=await targets(db,months),saved=await cache(db,list),ready=[];
      for(const target of list)if(saved.has(key(target))) {
        validateTarget(target);const evidence=checkedEvidence(target,saved.get(key(target)));
        ready.push({target,evidence,location:canonicalLocation(evidence.bairro,evidence.cidade)});
      }
      for(const {target,evidence,location} of ready) {
        const previous=extractLocationFields(target.order);
        if(previous.bairro&&canonicalLocation(previous.bairro,previous.cidade)!==location)fail('LOCALIDADE_BAIRRO_EXISTENTE_DIVERGENTE');
        const cityKey=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
        if(previous.cidade&&evidence.cidade&&cityKey(previous.cidade)!==cityKey(evidence.cidade))fail('LOCALIDADE_CIDADE_EXISTENTE_DIVERGENTE');
        const payload={...target.order,bairro:evidence.bairro,cidade:previous.cidade||evidence.cidade,id_cliente_servico:evidence.id_cliente_servico,
          location_recovery:{source:evidence.source,observedAt:evidence.observedAt,evidenceSha256:digest(evidence)}};
        await db.query("UPDATE source_records SET payload=$2::jsonb,updated_at=now() WHERE kind='serviceOrders' AND id=$1",[target.sale.id,JSON.stringify(payload)]);
        await db.query("UPDATE commercial_records SET payload=jsonb_set(payload,'{location}',$2::jsonb) WHERE kind='sales' AND id=$1",[target.id,JSON.stringify(location)]);
      }
      const report={months,updatedSales:ready.length,pendingSales:list.length-ready.length,addressBasis:'current_installation_address_of_exact_service',published:true};
      await db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        [`location_service_applied:${months.join(',')}:${Date.now()}`,JSON.stringify({...report,at:new Date().toISOString(),evidence:ready.map(({target,evidence})=>({sale:target.id,sha256:digest(evidence)}))})]);
      await db.query('COMMIT');return report;
    }catch(error){await db.query('ROLLBACK');throw error;}
  });
}
