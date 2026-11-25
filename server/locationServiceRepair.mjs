import {createHash} from 'node:crypto';
import {canonicalLocation} from '../server-dist/commercial.js';
import {exactId,localDay} from './historyPolicy.mjs';
import {clientCode,normalizeDate,normalizedAttendanceDetail} from './historyNormalization.mjs';
import {orderDate} from './historyFollowup.mjs';
import {extractLocationFields,serviceIdentity} from './locationFields.mjs';
import {locationRepairMonths} from './locationRecovery.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const MAX_CALLS=1500;
const LOOKUP_VERSION='all_customer_statuses_v1';
const CLIENT_CONFLICT='LOCALIDADE_CLIENTE_DIVERGENTE';
const targetKey=target=>target.kind==='sales'?target.id:`${target.kind}:${target.id}`;
const refreshConstraintKey=target=>`location_service_refresh_constraint:${target.month}:${targetKey(target)}`;
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
function checkedRefreshConstraint(target,saved) {
  const constraint=saved.get(refreshConstraintKey(target));
  if(!constraint)return '';
  if(constraint.version!==1||constraint.fingerprint!==signature(target)||constraint.kind!==target.kind||constraint.eventId!==target.id||
    constraint.attendanceId!==exactId(target.attendance.id_atendimento)||constraint.protocol!==exactId(target.attendance.protocolo)||
    constraint.customer!==exactId(target.attendance.codigo_cliente)||!/^location_service_evidence_archive:v1:[a-f0-9]{64}$/.test(constraint.auditKey??'')||!serviceIdentity(constraint))
    fail('LOCALIDADE_RECAPTURA_EXIGE_REVISAO');
  return serviceIdentity(constraint);
}
function checkedEvidence(target,evidence,expectedService='') {
  if(!evidence||evidence.fingerprint!==signature(target)||!evidence.observedAt||
    !canonicalLocation(evidence.bairro,evidence.cidade)||!serviceIdentity(evidence))fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
  const current=serviceIdentity(target.order)||serviceIdentity(target.attendance);
  if(expectedService&&expectedService!==evidence.id_cliente_servico)fail('HUBSOFT_SERVICO_DIVERGENTE');
  if(current&&current!==evidence.id_cliente_servico)fail('HUBSOFT_SERVICO_DIVERGENTE');
  return evidence;
}
function checkedPending(target,pending) {
  if(!pending||pending.lookupVersion!==LOOKUP_VERSION||pending.fingerprint!==signature(target)||!pending.observedAt)fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
  if(pending.code===CLIENT_CONFLICT){
    const a=target.attendance;
    if(pending.expectedCustomer!==exactId(a.codigo_cliente)||exactId(pending.observedCustomer)===pending.expectedCustomer||
      pending.attendanceId!==exactId(a.id_atendimento)||pending.protocol!==exactId(a.protocolo)||
      pending.openedDay!==localDay(a.data_cadastro)||serviceIdentity(pending))fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
    return pending;
  }
  if(!['LOCALIDADE_SERVICO_NAO_ENCONTRADO','LOCALIDADE_SERVICO_NAO_IDENTIFICADO'].includes(pending.code)||
    !(pending.code==='LOCALIDADE_SERVICO_NAO_IDENTIFICADO'&&target.kind!=='sales'&&!serviceIdentity(pending)||serviceIdentity(pending)))fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
  const id=serviceIdentity(target.order)||serviceIdentity(target.attendance);
  if(id&&id!==pending.id_cliente_servico)fail('HUBSOFT_SERVICO_DIVERGENTE');
  return pending;
}
async function cache(db,list) {
  if(!list.length)return new Map();
  return new Map((await db.query('SELECT key,value FROM application_settings WHERE key=ANY($1::text[])',[list.flatMap(target=>[key(target),identityKey(target),activeMissKey(target),pendingKey(target),refreshConstraintKey(target)])])).rows.map(row=>[row.key,row.value]));
}
async function withLock(pool,work) {
  const db=await pool.connect();let locked=false;
  try {
    locked=(await db.query('SELECT pg_try_advisory_lock(73190602) AS locked')).rows[0].locked;
    if(!locked)fail('SINCRONIZACAO_EM_ANDAMENTO');
    return await work(db);
  }finally{try{if(locked)await db.query('SELECT pg_advisory_unlock(73190602)');}finally{db.release();}}
}
// Inventory reads only published aggregates; it does not capture or publish events.
export async function inventoryServiceLocations(db,scope) {
  if(typeof scope!=='string'||!/^\d{4}(,\d{4})?$/.test(scope))fail('LOCALIDADE_ANOS_INVALIDOS');
  const years=scope.split(',').map(Number);
  if(years.some(year=>year<2025||year>9998)||years.length===2&&years[1]!==years[0]+1)fail('LOCALIDADE_ANOS_INVALIDOS');
  const empty=()=>({sales:0,missingSales:0,renewals:0,missingRenewals:0,cancellations:0,missingCancellations:0});
  const months=new Map(years.flatMap(year=>Array.from({length:12},(_,index)=>{
    const month=String(year)+'-'+String(index+1).padStart(2,'0');
    return [month,{month,...empty()}];
  })));
  const rows=(await db.query(`SELECT to_char(event_date AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') AS month,
    kind,payload->>'location' AS location,count(*)::int AS count
    FROM commercial_records
    WHERE kind=ANY($3::text[]) AND event_date >= $1::timestamptz AND event_date < $2::timestamptz
    GROUP BY 1,2,3 ORDER BY 1,2`,
    [years[0]+'-01-01 00:00:00-03',(years.at(-1)+1)+'-01-01 00:00:00-03',['sales','renewals','cancellations']])).rows;
  const missingKeys={sales:'missingSales',renewals:'missingRenewals',cancellations:'missingCancellations'};
  const totals=empty();
  for(const row of rows){
    const month=months.get(row.month),count=Number(row.count);
    month[row.kind]+=count;totals[row.kind]+=count;
    if(!canonicalLocation(row.location)){
      month[missingKeys[row.kind]]+=count;totals[missingKeys[row.kind]]+=count;
    }
  }
  return {years,months:[...months.values()],totals,published:false};
}
export async function planServiceLocations(db,scope,{allEvents=false}={}) {
  const months=locationRepairMonths(scope),list=await targets(db,months,allEvents),saved=await cache(db,list);
  const byKind=Object.fromEntries(['sales','renewals','cancellations'].map(kind=>[kind,{missing:0,ready:0,invalid:0,unresolved:0,uncaptured:0,readyByLocation:[]}]));
  const locationsByKind={sales:new Map(),renewals:new Map(),cancellations:new Map()};
  for(const target of list)byKind[target.kind].missing++;
  let ready=0,invalid=0,unresolved=0;const byLocation=new Map(),byReason=new Map();
  for(const target of list)try{
    validateTarget(target);checkedRefreshConstraint(target,saved);
    if(saved.has(key(target))){
      const evidence=checkedEvidence(target,saved.get(key(target)),checkedRefreshConstraint(target,saved)),location=canonicalLocation(evidence.bairro,evidence.cidade);
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
    uncaptured:list.length-ready-invalid-unresolved,deferredClientConflicts:byReason.get(CLIENT_CONFLICT)??0,maximumCalls:MAX_CALLS,callsReserved:used,
    addressBasis:'current_installation_address_of_exact_service',published:false};
}
function checkedDetail(target,detail) {
  const a=target.attendance;
  normalizedAttendanceDetail(a,detail,exactId(a.codigo_cliente),localDay(a.data_cadastro));
  return checkedService(target,detail);
}
function checkedService(target,detail) {
  const a=target.attendance,o=target.order;
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
function checkedClientConflict(target,detail) {
  const a=target.attendance;
  if(!detail||exactId(detail.id_atendimento)!==exactId(a.id_atendimento))fail('HUBSOFT_ATENDIMENTO_ID_DIVERGENTE');
  if(String(detail.protocolo)!==exactId(a.protocolo))fail('HUBSOFT_PROTOCOLO_DIVERGENTE');
  const expectedCustomer=exactId(a.codigo_cliente),observedCustomer=exactId(clientCode(detail));
  if(expectedCustomer===observedCustomer)fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
  const openedDay=localDay(a.data_cadastro);
  if(localDay(normalizeDate(detail.data_cadastro_br??detail.data_cadastro))!==openedDay)fail('HUBSOFT_ATENDIMENTO_DIA_DIVERGENTE');
  if(detail.deleted_at)fail('EXCLUSAO_EXIGE_RECONCILIACAO');
  // Check the remaining OS/service identities too. This is a blocked case, never address evidence.
  checkedService(target,detail);
  return {lookupVersion:LOOKUP_VERSION,code:CLIENT_CONFLICT,fingerprint:signature(target),
    attendanceId:exactId(a.id_atendimento),protocol:exactId(a.protocolo),openedDay,
    expectedCustomer,observedCustomer,observedAt:new Date().toISOString()};
}
function sameExecution(stored,observed) {
  const expected=orderDate(stored),actual=orderDate(observed);
  return expected.length===16?actual.slice(0,16)===expected:actual===expected;
}
export async function captureServiceLocations(pool,client,scope,{maxCalls=4,retryUnresolved=false,allEvents=false,deferClientConflicts=false,env=process.env}={}) {
  const months=locationRepairMonths(scope);
  if(!Number.isInteger(maxCalls)||maxCalls<4||maxCalls>100||typeof retryUnresolved!=='boolean'||typeof allEvents!=='boolean'||typeof deferClientConflicts!=='boolean')fail('LOCALIDADE_ORCAMENTO_INVALIDO');
  if(env.HUBSOFT_HISTORY_IP_COORDINATED!=='true'||!(env.HUBSOFT_AUTOMATIC_ENABLED==='true'||env.HUBSOFT_HISTORY_ENABLED==='true')||
    client.gate?.interval!==1000)fail('LOCALIDADE_EXIGE_GATE_COORDENADO_1_REQ_S');
  return withLock(pool,async db=>{
    const originalGate=client.gate;let calls=0,captured=0,reused=0,unresolved=0,deferredClientConflicts=0;
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
        const expectedService=checkedRefreshConstraint(target,saved);
        if(saved.has(key(target))){checkedEvidence(target,saved.get(key(target)),checkedRefreshConstraint(target,saved));reused++;continue;}
        const pending=saved.get(pendingKey(target));
        if(pending){
          checkedPending(target,pending);
          if(pending.code===CLIENT_CONFLICT&&!deferClientConflicts)fail('HUBSOFT_CLIENTE_DIVERGENTE');
          if(!retryUnresolved){
            unresolved++;unresolvedKinds[target.kind]++;
            if(pending.code===CLIENT_CONFLICT)deferredClientConflicts++;
            continue;
          }
        }
        if(maxCalls-calls<4)break;
        // One protocol plus two client-status queries and a possible OAuth call fit the four-call reservation.
        let identity=saved.get(identityKey(target));
        if(identity) {
          if(expectedService&&serviceIdentity(identity)!==expectedService)fail('HUBSOFT_SERVICO_DIVERGENTE');
          if(identity.fingerprint!==signature(target)||!serviceIdentity(identity))fail('LOCALIDADE_EVIDENCIA_DIVERGENTE');
        } else {
          const detail=await client.attendanceDetail(exactId(target.attendance.protocolo));
          let id;
          try {id=checkedDetail(target,detail);}
          catch(error){
            if(!deferClientConflicts||(error.code??error.message)!=='HUBSOFT_CLIENTE_DIVERGENTE')throw error;
            const conflict=checkedClientConflict(target,detail);
            if(expectedService&&checkedService(target,detail)!==expectedService)fail('HUBSOFT_SERVICO_DIVERGENTE');
            await save(pendingKey(target),conflict);
            unresolved++;unresolvedKinds[target.kind]++;deferredClientConflicts++;
            continue;
          }
          if(expectedService&&id!==expectedService)fail('HUBSOFT_SERVICO_DIVERGENTE');
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
      return {months,scope:allEvents?'all_events':'sales',captured,reused,unresolvedEvents:unresolved,unresolvedSales:unresolvedKinds.sales,unresolvedByKind:unresolvedKinds,deferredClientConflicts,callsThisRun:calls,callsReserved:used,maximumCalls:MAX_CALLS,published:false};
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
        validateTarget(target);const evidence=checkedEvidence(target,saved.get(key(target)),checkedRefreshConstraint(target,saved));
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

// Shared strict validators and collector lock for the separately authorized customer reconciliation.
export {validateTarget as validateLocationTarget,checkedDetail as checkedLocationDetail,withLock as withLocationRepairLock};

function refreshSelection(scope,{kind,eventId}={}) {
  const months=locationRepairMonths(scope);
  if(!['sales','renewals','cancellations'].includes(kind)||typeof eventId!=='string'||
    !/^[a-zA-Z0-9:_-]{1,300}$/.test(eventId))fail('LOCALIDADE_EVENTO_INVALIDO');
  return {months,kind,eventId};
}
async function staleEvidencePreview(db,selection) {
  const {months,kind,eventId}=selection;
  const matches=(await targets(db,months,true)).filter(t=>t.kind===kind&&t.id===eventId);
  if(matches.length!==1)fail('LOCALIDADE_EVENTO_NAO_ENCONTRADO');
  const target=matches[0];validateTarget(target);
  if(target.attendance.deleted_at||target.order?.deleted_at)fail('EXCLUSAO_EXIGE_RECONCILIACAO');
  const saved=await cache(db,[target]),evidence=saved.get(key(target));
  if(!evidence)fail('LOCALIDADE_EVIDENCIA_AUSENTE');
  const service=serviceIdentity(evidence),currentSignature=signature(target);
  if(evidence.version!==1||evidence.source!=='hubsoft_exact_service_current_installation_address'||
    !/^[a-f0-9]{64}$/.test(evidence.fingerprint??'')||!service||
    !canonicalLocation(evidence.bairro,evidence.cidade)||!Number.isFinite(Date.parse(evidence.observedAt)))
    fail('LOCALIDADE_EVIDENCIA_INVALIDA');
  if(evidence.fingerprint===currentSignature)fail('LOCALIDADE_EVIDENCIA_JA_ATUAL');
  if(saved.has(pendingKey(target)))fail('LOCALIDADE_PENDENCIA_EXIGE_REVISAO');
  const currentServices=[serviceIdentity(target.order),serviceIdentity(target.attendance)].filter(Boolean);
  if(currentServices.some(id=>id!==service))fail('HUBSOFT_SERVICO_DIVERGENTE');
  const checkpoints=[...saved].sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>{
    if(value.fingerprint!==evidence.fingerprint||serviceIdentity(value)!==service)fail('LOCALIDADE_CHECKPOINT_DIVERGENTE');
    return {key:name,sha256:digest(value)};
  });
  const report={months,kind,eventId,month:target.month,attendanceId:exactId(target.attendance.id_atendimento),
    protocol:exactId(target.attendance.protocolo),customer:exactId(target.attendance.codigo_cliente),
    serviceId:service,previousLocation:canonicalLocation(evidence.bairro,evidence.cidade),
    evidenceObservedAt:evidence.observedAt,previousFingerprint:evidence.fingerprint,currentFingerprint:currentSignature,
    state:'stale_evidence',checkpointsToArchive:checkpoints.length,requiresFreshCapture:true,
    published:false};
  return {report:{...report,previewHash:digest({report,checkpoints})},checkpoints};
}
// These operations are local-only: they never approve stale evidence or initiate HTTP.
export async function planServiceEvidenceRefresh(db,scope,options) {
  return (await staleEvidencePreview(db,refreshSelection(scope,options))).report;
}
export async function archiveStaleServiceEvidence(pool,scope,{kind,eventId,acceptArchive=false,expectedPreview}={}) {
  const selection=refreshSelection(scope,{kind,eventId});
  if(!acceptArchive)fail('LOCALIDADE_ARQUIVAMENTO_ACEITE_OBRIGATORIO');
  if(!/^[a-f0-9]{64}$/.test(expectedPreview??''))fail('LOCALIDADE_PREVIA_OBRIGATORIA');
  const auditKey=`location_service_evidence_archive:v1:${expectedPreview}`;
  return withLock(pool,async db=>{
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    try {
      const existing=(await db.query('SELECT value FROM application_settings WHERE key=$1',[auditKey])).rows[0]?.value;
      if(existing){
        if(existing.previewHash!==expectedPreview||existing.kind!==kind||existing.eventId!==eventId||
          JSON.stringify(existing.months)!==JSON.stringify(selection.months))fail('LOCALIDADE_AUDITORIA_DIVERGENTE');
        await db.query('COMMIT');return {state:'already_archived',archivedCheckpoints:0,auditKey,published:false};
      }
      const {report,checkpoints}=await staleEvidencePreview(db,selection);
      if(report.previewHash!==expectedPreview)fail('LOCALIDADE_PREVIA_DIVERGENTE');
      const archived=[];
      for(const point of checkpoints){
        const archiveKey=`${auditKey}:checkpoint:${point.key}`;
        const result=await db.query('UPDATE application_settings SET key=$2 WHERE key=$1 RETURNING key',[point.key,archiveKey]);
        if(result.rows.length!==1)fail('LOCALIDADE_CHECKPOINT_ALTERADO');
        archived.push({...point,archiveKey});
      }
      // This is a constraint, never a reusable identity: fresh protocol validation remains mandatory.
      await db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb)',[
        refreshConstraintKey({month:report.month,kind,id:eventId}),JSON.stringify({version:1,
          fingerprint:report.currentFingerprint,id_cliente_servico:report.serviceId,kind,eventId,
          attendanceId:report.attendanceId,protocol:report.protocol,customer:report.customer,auditKey})
      ]);
      await db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb)',[auditKey,JSON.stringify({
        ...report,reason:'source_fingerprint_changed',archived,archivedAt:new Date().toISOString()
      })]);
      await db.query('COMMIT');
      return {months:selection.months,kind,eventId,state:'needs_fresh_capture',archivedCheckpoints:archived.length,
        auditKey,budgetUnchanged:true,published:false};
    }catch(error){await db.query('ROLLBACK');throw error;}
  });
}
