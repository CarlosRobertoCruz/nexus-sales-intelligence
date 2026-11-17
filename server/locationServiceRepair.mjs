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
const targetKey=target=>target.kind==='sales'?target.id:`${target.kind}:${target.id}`;
const pendingKey=target=>`location_service_pending:${target.month}:${targetKey(target)}`;
const key=target=>`location_service_evidence:${target.month}:${targetKey(target)}`;
const identityKey=target=>`location_service_identity:${target.month}:${targetKey(target)}`;
const activeMissKey=target=>`location_service_active_miss:${target.month}:${targetKey(target)}`;
const budgetKey=months=>`location_service_budget:v1:${months.join(',')}`;
function stable(value) {
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
const digest=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
function signature(target) {
  const {location:_location,...sale}=target.sale;
  return target.kind==='sales'?digest({sale,attendance:target.attendance,order:target.order})
    :digest({kind:target.kind,event:sale,attendance:target.attendance});
}
async function targets(db,months,allEvents=false) {
  const rows=(await db.query(`SELECT c.kind,c.id,c.payload AS sale,a.id AS "attendanceSourceId",
    to_char(c.event_date AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS "eventDay",
    to_char(c.event_date AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') AS month,
    a.payload AS attendance,o.payload AS "order"
    FROM commercial_records c
    LEFT JOIN source_records a ON a.kind='attendance' AND (
      (c.kind='sales' AND a.id=c.payload->>'attendanceId') OR
      (c.kind<>'sales' AND a.payload->>'protocolo'=c.payload->>'id'))
    LEFT JOIN source_records o ON c.kind='sales' AND o.kind='serviceOrders' AND o.id=c.payload->>'id'
    WHERE c.kind=ANY($2::text[]) AND to_char(c.event_date AT TIME ZONE 'America/Sao_Paulo','YYYY-MM')=ANY($1::text[])
    ORDER BY c.kind,c.id`,[months,allEvents?['sales','renewals','cancellations']:['sales']])).rows;
  if(new Set(rows.map(row=>`${row.kind}:${row.id}`)).size!==rows.length)fail('LOCALIDADE_VINCULO_AMBIGUO');
  return rows.filter(row=>!canonicalLocation(row.sale.location));
}
const normalizedText=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const countsByKind=list=>Object.fromEntries(['sales','renewals','cancellations'].map(kind=>[kind,list.filter(target=>target.kind===kind).length]));
function validateTarget(target) {
  const {attendance:a,order:o,sale}=target;
  if(target.kind!=='sales'){
    if(!a||a.classification_status||a.publication_scope==='manual_staging'||a.publication_scope==='installation_context')fail('LOCALIDADE_FONTE_INDISPONIVEL');
    if(target.attendanceSourceId!==`hubsoft:${exactId(a.id_atendimento)}`||sale.id!==exactId(a.protocolo))fail('LOCALIDADE_VINCULO_DIVERGENTE');
    exactId(a.codigo_cliente);
    const opened=localDay(a.data_cadastro),type=normalizedText(a.tipo_atendimento),status=normalizedText(a.status);
    if(opened<'2025-01-01'||opened!==target.eventDay||opened.slice(0,7)!==target.month)fail('LOCALIDADE_DATA_DIVERGENTE');
    if(target.kind==='renewals'&&!(['renovacao de contrato','alteracao de plano'].includes(type)&&['resolvido','finalizado','pendente'].includes(status))||
       target.kind==='cancellations'&&!(type==='cancelamento'&&status==='resolvido'&&sale.completed===true))fail('LOCALIDADE_TIPO_DIVERGENTE');
    return;
  }
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
  if(!pending||pending.lookupVersion!==LOOKUP_VERSION||!['LOCALIDADE_SERVICO_NAO_ENCONTRADO','LOCALIDADE_SERVICO_NAO_IDENTIFICADO'].includes(pending.code)||
    pending.fingerprint!==signature(target)||!pending.observedAt||
    !(pending.code==='LOCALIDADE_SERVICO_NAO_IDENTIFICADO'&&target.kind!=='sales'&&!serviceIdentity(pending)||serviceIdentity(pending)))fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
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
export async function planServiceLocations(db,scope,{allEvents=false}={}) {
  const months=locationRepairMonths(scope),list=await targets(db,months,allEvents),saved=await cache(db,list);
  const byKind=Object.fromEntries(['sales','renewals','cancellations'].map(kind=>[kind,{missing:0,ready:0,invalid:0,unresolved:0,uncaptured:0,readyByLocation:[]}]));
  const locationsByKind={sales:new Map(),renewals:new Map(),cancellations:new Map()};
  for(const target of list)byKind[target.kind].missing++;
  let ready=0,invalid=0,unresolved=0;const byLocation=new Map(),byReason=new Map();
  for(const target of list)try{
    validateTarget(target);
    if(saved.has(key(target))){
      const evidence=checkedEvidence(target,saved.get(key(target))),location=canonicalLocation(evidence.bairro,evidence.cidade);
      ready++;byKind[target.kind].ready++;byLocation.set(location,(byLocation.get(location)??0)+1);
      const locations=locationsByKind[target.kind];locations.set(location,(locations.get(location)??0)+1);
    }else if(saved.has(pendingKey(target))){
      const pending=checkedPending(target,saved.get(pendingKey(target)));unresolved++;byKind[target.kind].unresolved++;
      byReason.set(pending.code,(byReason.get(pending.code)??0)+1);
    }
  }catch{invalid++;byKind[target.kind].invalid++;}
  for(const [kind,item] of Object.entries(byKind)){item.uncaptured=item.missing-item.ready-item.invalid-item.unresolved;item.readyByLocation=[...locationsByKind[kind]].map(([location,events])=>({location,events}));}
  const used=(await db.query('SELECT value FROM application_settings WHERE key=$1',[budgetKey(months)])).rows[0]?.value?.used??0;
  return {months,scope:allEvents?'all_events':'sales',missingEvents:list.length,missingSales:byKind.sales.missing,
    missingRenewals:byKind.renewals.missing,missingCancellations:byKind.cancellations.missing,byKind,readyForReview:ready,readyByLocation:[...byLocation].map(([location,count])=>allEvents?{location,events:count}:{location,sales:count}),invalidEvidenceOrSource:invalid,
    unresolvedEvents:unresolved,unresolvedSales:byKind.sales.unresolved,unresolvedByReason:[...byReason].map(([code,count])=>allEvents?{code,events:count}:{code,sales:count}),
    uncaptured:list.length-ready-invalid-unresolved,maximumCalls:MAX_CALLS,callsReserved:used,
    addressBasis:'current_installation_address_of_exact_service',published:false};
}
function checkedDetail(target,detail) {
  const a=target.attendance,o=target.order;
  normalizedAttendanceDetail(a,detail,exactId(a.codigo_cliente),localDay(a.data_cadastro));
  if(target.kind!=='sales'){
    const ids=[serviceIdentity(detail),serviceIdentity(a)].filter(Boolean);
    if(new Set(ids).size>1)fail('HUBSOFT_SERVICO_DIVERGENTE');
    return ids[0]??'';
  }
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
export async function captureServiceLocations(pool,client,scope,{maxCalls=4,retryUnresolved=false,allEvents=false,env=process.env}={}) {
  const months=locationRepairMonths(scope);
  if(!Number.isInteger(maxCalls)||maxCalls<4||maxCalls>100||typeof retryUnresolved!=='boolean'||typeof allEvents!=='boolean')fail('LOCALIDADE_ORCAMENTO_INVALIDO');
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
      const list=await targets(db,months,allEvents),saved=await cache(db,list);
      const unresolvedKinds={sales:0,renewals:0,cancellations:0};
      for(const target of list) {
        validateTarget(target);
        if(saved.has(key(target))){checkedEvidence(target,saved.get(key(target)));reused++;continue;}
        const pending=saved.get(pendingKey(target));
        if(pending){
          checkedPending(target,pending);
          if(!retryUnresolved){unresolved++;unresolvedKinds[target.kind]++;continue;}
        }
        if(maxCalls-calls<4)break;
        // One protocol plus two client-status queries and a possible OAuth call fit the four-call reservation.
        let identity=saved.get(identityKey(target));
        if(identity) {
          if(identity.fingerprint!==signature(target)||!serviceIdentity(identity))fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
        } else {
          const detail=await client.attendanceDetail(exactId(target.attendance.protocolo));
          const id=checkedDetail(target,detail);
          if(!id){
            await save(pendingKey(target),{lookupVersion:LOOKUP_VERSION,code:'LOCALIDADE_SERVICO_NAO_IDENTIFICADO',fingerprint:signature(target),observedAt:new Date().toISOString()});
            unresolved++;unresolvedKinds[target.kind]++;continue;
          }
          identity={fingerprint:signature(target),id_cliente_servico:id,observedAt:new Date().toISOString()};
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
          unresolved++;unresolvedKinds[target.kind]++;continue;
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
      return {months,scope:allEvents?'all_events':'sales',captured,reused,unresolvedEvents:unresolved,unresolvedSales:unresolvedKinds.sales,unresolvedByKind:unresolvedKinds,callsThisRun:calls,callsReserved:used,maximumCalls:MAX_CALLS,published:false};
    }finally{client.gate=originalGate;}
  });
}
export async function applyServiceLocations(pool,scope,{acceptCurrentServiceAddress=false,allEvents=false}={}) {
  const months=locationRepairMonths(scope);
  if(!acceptCurrentServiceAddress)fail('LOCALIDADE_REVISAO_ENDERECO_ATUAL_OBRIGATORIA');
  return withLock(pool,async db=>{
    await db.query('BEGIN');
    try {
      const list=await targets(db,months,allEvents),saved=await cache(db,list),ready=[],sourceUpdates=new Map();
      for(const target of list)if(saved.has(key(target))) {
        validateTarget(target);const evidence=checkedEvidence(target,saved.get(key(target)));
        ready.push({target,evidence,location:canonicalLocation(evidence.bairro,evidence.cidade)});
      }
      for(const {target,evidence,location} of ready) {
        const source=target.kind==='sales'?target.order:target.attendance;
        const sourceKind=target.kind==='sales'?'serviceOrders':'attendance';
        const sourceId=target.kind==='sales'?target.sale.id:target.attendanceSourceId;
        const sourceKey=`${sourceKind}:${sourceId}`;
        const recovered={bairro:evidence.bairro,cidade:evidence.cidade,id_cliente_servico:evidence.id_cliente_servico};
        if(sourceUpdates.has(sourceKey)&&sourceUpdates.get(sourceKey)!==digest(recovered))fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
        sourceUpdates.set(sourceKey,digest(recovered));
        const previous=extractLocationFields(source);
        if(previous.bairro&&canonicalLocation(previous.bairro,previous.cidade)!==location)fail('LOCALIDADE_BAIRRO_EXISTENTE_DIVERGENTE');
        const cityKey=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
        if(previous.cidade&&evidence.cidade&&cityKey(previous.cidade)!==cityKey(evidence.cidade))fail('LOCALIDADE_CIDADE_EXISTENTE_DIVERGENTE');
        const payload={...source,bairro:evidence.bairro,cidade:previous.cidade||evidence.cidade,id_cliente_servico:evidence.id_cliente_servico,
          location_recovery:{source:evidence.source,observedAt:evidence.observedAt,evidenceSha256:digest(evidence)}};
        await db.query('UPDATE source_records SET payload=$3::jsonb,updated_at=now() WHERE kind=$1 AND id=$2',[sourceKind,sourceId,JSON.stringify(payload)]);
        await db.query("UPDATE commercial_records SET payload=jsonb_set(payload,'{location}',$3::jsonb) WHERE kind=$1 AND id=$2",[target.kind,target.id,JSON.stringify(location)]);
      }
      const updated=countsByKind(ready.map(row=>row.target)),pendingCounts=countsByKind(list);
      for(const kind of Object.keys(pendingCounts))pendingCounts[kind]-=updated[kind];
      const report={months,scope:allEvents?'all_events':'sales',updatedEvents:ready.length,updatedSales:updated.sales,updatedRenewals:updated.renewals,updatedCancellations:updated.cancellations,
        pendingEvents:list.length-ready.length,pendingSales:pendingCounts.sales,pendingRenewals:pendingCounts.renewals,pendingCancellations:pendingCounts.cancellations,addressBasis:'current_installation_address_of_exact_service',published:true};
      await db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        [`location_service_applied:${months.join(',')}:${Date.now()}`,JSON.stringify({...report,at:new Date().toISOString(),evidence:ready.map(({target,evidence})=>({kind:target.kind,event:target.id,sha256:digest(evidence)}))})]);
      await db.query('COMMIT');return report;
    }catch(error){await db.query('ROLLBACK');throw error;}
  });
}
