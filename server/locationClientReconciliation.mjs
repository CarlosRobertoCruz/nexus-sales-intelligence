import {createHash,randomUUID} from 'node:crypto';
import {classifyStoredRows} from './records.mjs';
import {exactId,localDay} from './historyPolicy.mjs';
import {clientCode,normalizeDate} from './historyNormalization.mjs';
import {serviceIdentity} from './locationFields.mjs';
import {orderDate} from './historyFollowup.mjs';
import {canonicalLocation} from '../server-dist/commercial.js';
import {validateLocationTarget,checkedLocationDetail,withLocationRepairLock} from './locationServiceRepair.mjs';

// Authorization is deliberately confined to this reviewed case, not all customer conflicts.
export const CLIENT_RECONCILIATION_CASE=Object.freeze({
  caseId:'attendance-215431-order-47911',attendanceId:'215431',orderId:'47911',
  protocol:'20251209161519693515',orderNumber:'037225343161519088',
  oldCustomer:'8211',newCustomer:'14926',serviceId:'22709',openedDay:'2025-12-09',
  started:'12/12/2025 10:22:52',finished:'12/12/2025 13:53:34',month:'2025-12',
  scope:'2025-11,2025-12',listPage:1
});
const spec=CLIENT_RECONCILIATION_CASE;
const prefix=`location_client_reconciliation:${spec.caseId}`;
const headKey=`${prefix}:head`,auditKey=`${prefix}:applied`;
const budgetKey=`location_service_budget:v1:${spec.scope}`;
const MAX_CALLS=1500,MAX_AGE_MS=24*60*60*1000;
const fail=code=>{throw Object.assign(new Error(code),{code});};
function stable(v){
  if(v instanceof Date)return v.toISOString();
  if(Array.isArray(v))return v.map(stable);
  if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
  return v;
}
const hash=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const read=async(db,key)=>(await db.query('SELECT value FROM application_settings WHERE key=$1',[key])).rows[0]?.value;
const save=(db,key,value)=>db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,JSON.stringify(value)]);
const commercialKinds=['sales','renewals','cancellations','reactivations'];
function commercialSummary(raw){
  const classified=classifyStoredRows(raw);
  if(!classified)fail('RECONCILIACAO_CLASSIFICACAO_INDISPONIVEL');
  return Object.fromEntries(commercialKinds.map(k=>[k,[...classified[k]].sort((a,b)=>String(a.businessKey??a.id).localeCompare(String(b.businessKey??b.id)))]));
}
async function snapshot(db){
  const sources=(await db.query("SELECT kind,id,payload,source FROM source_records ORDER BY kind,id")).rows;
  const attendance=sources.find(r=>r.kind==='attendance'&&r.id===`hubsoft:${spec.attendanceId}`);
  const order=sources.find(r=>r.kind==='serviceOrders'&&r.id===`hubsoft:${spec.orderId}`);
  if(!attendance||!order)fail('RECONCILIACAO_FONTE_AUSENTE');
  const applied=await read(db,auditKey);
  if(applied){
    if(applied.caseId!==spec.caseId||applied.oldCustomer!==spec.oldCustomer||applied.newCustomer!==spec.newCustomer||
       ![attendance,order].every(r=>r.payload.codigo_cliente===spec.newCustomer&&r.payload.client_reconciliation?.auditKey===auditKey))
      fail('RECONCILIACAO_AUDITORIA_DIVERGENTE');
    return {applied:true};
  }
  const a=attendance.payload,o=order.payload;
  if([attendance,order].some(r=>r.source!=='hubsoft'||r.payload.client_reconciliation||r.payload.publication_scope==='manual_staging'||r.payload.deleted_at))
    fail('RECONCILIACAO_FONTE_INVALIDA');
  if(a.codigo_cliente!==spec.oldCustomer||o.codigo_cliente!==spec.oldCustomer||
     clientCode(a)!==spec.oldCustomer||clientCode(o)!==spec.oldCustomer)
    fail('RECONCILIACAO_CLIENTE_ESPERADO_DIVERGENTE');
  // Published Hubsoft records are flat. Do not leave a contradictory nested customer behind.
  if(a.cliente||a.cliente_servico?.cliente||o.cliente||o.cliente_servico?.cliente)
    fail('RECONCILIACAO_FONTE_NAO_NORMALIZADA');
  if(a.protocolo!==spec.protocol||localDay(a.data_cadastro)!==spec.openedDay||o.numero_ordem_servico!==spec.orderNumber||
     orderDate(o.data_inicio_executado)!==spec.started||orderDate(o.data_termino_executado)!==spec.finished)
    fail('RECONCILIACAO_IDENTIDADE_DIVERGENTE');
  if(sources.some(r=>r.kind==='serviceOrders'&&String(r.payload.id_atendimento)===spec.attendanceId&&r.id!==order.id))
    fail('RECONCILIACAO_OS_ADICIONAL');
  const events=(await db.query(`SELECT kind,id,event_date,payload,
    to_char(event_date AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS "eventDay" FROM commercial_records
    WHERE payload->>'attendanceId'=$1 OR (kind='sales' AND payload->>'id'=$2)
      OR (kind IN ('renewals','cancellations') AND payload->>'id'=$3)
    ORDER BY kind,id`,[attendance.id,order.id,spec.protocol])).rows;
  const sales=events.filter(r=>r.kind==='sales'&&r.payload.id===order.id);
  if(sales.length!==1)fail('RECONCILIACAO_VENDA_AMBIGUA');
  if(events.some(r=>r.kind!=='sales'||r.id!==sales[0].id))fail('RECONCILIACAO_EVENTO_ADICIONAL');
  if(canonicalLocation(sales[0].payload.location)||a.location_recovery||o.location_recovery)
    fail('RECONCILIACAO_GEOGRAFIA_EXISTENTE');
  const target={kind:'sales',id:sales[0].id,month:spec.month,eventDay:'2025-12-12',
    attendanceSourceId:attendance.id,sale:sales[0].payload,attendance:a,order:o};
  validateLocationTarget(target);
  if(sales[0].eventDay!=='2025-12-12')fail('RECONCILIACAO_DATA_COMERCIAL_DIVERGENTE');
  const changed=[attendance,order].map(r=>({...r,payload:{...r.payload,codigo_cliente:spec.newCustomer}}));
  const candidate={...target,attendance:changed[0].payload,order:changed[1].payload};
  validateLocationTarget(candidate);
  for(const payload of [a,o])if(serviceIdentity(payload)&&serviceIdentity(payload)!==spec.serviceId)fail('HUBSOFT_SERVICO_DIVERGENTE');
  const next=sources.map(r=>changed.find(c=>c.kind===r.kind&&c.id===r.id)??r);
  const before=commercialSummary(sources.filter(r=>r.payload.publication_scope!=='manual_staging'));
  const after=commercialSummary(next.filter(r=>r.payload.publication_scope!=='manual_staging'));
  if(hash(before)!==hash(after))fail('RECONCILIACAO_ALTERARIA_INDICADORES');
  const keys=['evidence','identity','active_miss','pending'].map(k=>`location_service_${k}:${spec.month}:${order.id}`);
  const checkpoints=(await db.query('SELECT key,value FROM application_settings WHERE key=ANY($1::text[]) ORDER BY key',[keys])).rows;
  return {attendance,order,target,candidate,changed,checkpoints,
    fingerprint:hash({attendance,order,events,checkpoints}),classificationHash:hash(before),
    counts:Object.fromEntries(commercialKinds.map(k=>[k,before[k].length]))};
}
function checkedProof(state,proof){
  if(!proof||proof.caseId!==spec.caseId||proof.sourceFingerprint!==state.fingerprint||proof.serviceId!==spec.serviceId||
     proof.oldCustomer!==spec.oldCustomer||proof.newCustomer!==spec.newCustomer||proof.protocol!==spec.protocol||
     proof.attendanceId!==spec.attendanceId||proof.orderId!==spec.orderId||proof.orderNumber!==spec.orderNumber||
     proof.openedDay!==spec.openedDay||proof.started!==spec.started||proof.finished!==spec.finished||
     proof.listPage!==spec.listPage||proof.detailVerified!==true||proof.listVerified!==true||
     !Number.isFinite(Date.parse(proof.observedAt))||Date.parse(proof.observedAt)>Date.now()||Date.now()-Date.parse(proof.observedAt)>MAX_AGE_MS)
    fail('RECONCILIACAO_PROVA_INVALIDA_OU_EXPIRADA');
}
async function preview(db,state){
  if(state.applied)return {caseId:spec.caseId,state:'already_applied',published:false};
  const head=await read(db,headKey);
  if(head&&!(typeof head.proofKey==='string'&&head.proofKey.startsWith(`${prefix}:proof:`)))fail('RECONCILIACAO_PROVA_INVALIDA_OU_EXPIRADA');
  const proof=head?await read(db,head.proofKey):undefined;
  let ready=false;
  if(proof){checkedProof(state,proof);ready=true;}
  const result={caseId:spec.caseId,state:ready?'ready_for_review':'needs_capture',
    attendanceId:spec.attendanceId,protocol:spec.protocol,orderId:spec.orderId,orderNumber:spec.orderNumber,
    oldCustomer:spec.oldCustomer,newCustomer:spec.newCustomer,serviceId:spec.serviceId,
    sourceFingerprint:state.fingerprint,counts:state.counts,commercialChanges:0,
    checkpointsToArchive:state.checkpoints.length,proofKey:head?.proofKey??null,observedAt:proof?.observedAt??null,published:false};
  return {...result,previewHash:hash(result)};
}
export async function planClientReconciliation(db){return preview(db,await snapshot(db));}
export async function captureClientReconciliation(pool,client,{env=process.env}={}){
  if(env.HUBSOFT_HISTORY_IP_COORDINATED!=='true'||!(env.HUBSOFT_AUTOMATIC_ENABLED==='true'||env.HUBSOFT_HISTORY_ENABLED==='true')||client.gate?.interval!==1000)
    fail('LOCALIDADE_EXIGE_GATE_COORDENADO_1_REQ_S');
  return withLocationRepairLock(pool,async db=>{
    const state=await snapshot(db);
    if(state.applied)return preview(db,state);
    const original=client.gate;let calls=0,used=Number((await read(db,budgetKey))?.used??0);
    if(!Number.isInteger(used)||used<0||used>MAX_CALLS)fail('LOCALIDADE_ORCAMENTO_INVALIDO');
    if(MAX_CALLS-used<4)fail('LOCALIDADE_ORCAMENTO_ATINGIDO');
    client.gate={interval:original.interval,token:work=>original.token(work),invalidateToken:()=>original.invalidateToken(),
      perform:(meta,send)=>original.perform(meta,async()=>{
        if(calls>=4||used>=MAX_CALLS)fail('LOCALIDADE_ORCAMENTO_ATINGIDO');
        calls++;used++;await save(db,budgetKey,{used,maximum:MAX_CALLS,updatedAt:new Date().toISOString()});
        return send();
      })};
    try{
      const detail=await client.attendanceDetail(spec.protocol);
      if(checkedLocationDetail(state.candidate,detail)!==spec.serviceId)fail('HUBSOFT_SERVICO_DIVERGENTE');
      // Require the exact service in the OS as well as the attendance, not just a customer's other contract.
      const linked=detail.ordens_servico.find(o=>String(o.id_ordem_servico)===spec.orderId);
      if(serviceIdentity(detail)!==spec.serviceId||serviceIdentity(linked)!==spec.serviceId)fail('HUBSOFT_SERVICO_DIVERGENTE');
      const page=await client.page('attendance',spec.openedDay,spec.listPage);
      const matches=page.records.filter(r=>String(r.id_atendimento)===spec.attendanceId);
      if(matches.length!==1)fail('RECONCILIACAO_LISTAGEM_NAO_CONFIRMADA');
      const listed=matches[0];
      if(exactId(listed.protocolo)!==spec.protocol||exactId(clientCode(listed))!==spec.newCustomer||listed.deleted_at||
         localDay(normalizeDate(listed.data_cadastro_br??listed.data_cadastro))!==spec.openedDay||
         (serviceIdentity(listed)&&serviceIdentity(listed)!==spec.serviceId))fail('RECONCILIACAO_LISTAGEM_DIVERGENTE');
      const current=await snapshot(db);
      if(current.applied||current.fingerprint!==state.fingerprint)fail('RECONCILIACAO_FONTE_ALTERADA');
      const proof={...spec,sourceFingerprint:state.fingerprint,detailVerified:true,listVerified:true,observedAt:new Date().toISOString()};
      const proofKey=`${prefix}:proof:${randomUUID()}`;
      await save(db,proofKey,proof);await save(db,headKey,{proofKey});
      return {...await preview(db,state),callsThisRun:calls,callsReserved:used,maximumCalls:MAX_CALLS};
    }finally{client.gate=original;}
  });
}
export async function applyClientReconciliation(pool,{acceptClientChange=false,expectedPreview}={}){
  if(!acceptClientChange)fail('RECONCILIACAO_ACEITE_OBRIGATORIO');
  if(!/^[a-f0-9]{64}$/.test(expectedPreview??''))fail('RECONCILIACAO_PREVIA_OBRIGATORIA');
  return withLocationRepairLock(pool,async db=>{
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    try{
      const state=await snapshot(db);
      if(state.applied){await db.query('COMMIT');return {caseId:spec.caseId,state:'already_applied',updatedSources:0,published:false};}
      const reviewed=await preview(db,state);
      if(reviewed.state!=='ready_for_review'||reviewed.previewHash!==expectedPreview)fail('RECONCILIACAO_PREVIA_DIVERGENTE');
      const marker={caseId:spec.caseId,oldCustomer:spec.oldCustomer,newCustomer:spec.newCustomer,serviceId:spec.serviceId,proofKey:reviewed.proofKey,auditKey};
      for(const row of state.changed)await db.query(`UPDATE source_records
        SET payload=$3::jsonb,updated_at=now() WHERE kind=$1 AND id=$2`,
        [row.kind,row.id,JSON.stringify({...row.payload,client_reconciliation:marker})]);
      const archived=[];
      for(const checkpoint of state.checkpoints){
        const archiveKey=`${prefix}:archive:${checkpoint.key}`;
        await db.query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb)',[archiveKey,JSON.stringify(checkpoint.value)]);
        await db.query('DELETE FROM application_settings WHERE key=$1',[checkpoint.key]);
        archived.push({originalKey:checkpoint.key,archiveKey,sha256:hash(checkpoint.value)});
      }
      const audit={...marker,attendanceId:spec.attendanceId,orderId:spec.orderId,protocol:spec.protocol,
        previewHash:expectedPreview,sourceFingerprintBefore:state.fingerprint,classificationHash:state.classificationHash,
        counts:state.counts,archived,appliedAt:new Date().toISOString()};
      await save(db,auditKey,audit);
      await db.query('COMMIT');
      return {caseId:spec.caseId,updatedSources:2,oldCustomer:spec.oldCustomer,newCustomer:spec.newCustomer,
        archivedCheckpoints:archived.length,commercialChanges:0,counts:state.counts,auditKey,published:true,
        geographyPublished:false,next:'repair-service-locations capture with the original scope'};
    }catch(error){await db.query('ROLLBACK');throw error;}
  });
}
