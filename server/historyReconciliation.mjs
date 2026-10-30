import {exactId,validateManifest,monthsFor,checklistExclusions} from './historyPolicy.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const native={attendance:'id_atendimento',serviceOrders:'id_ordem_servico'};
const business={attendance:'protocolo',serviceOrders:'numero_ordem_servico'};

export function compareHistoryReport(kind,rows,evidence,reference) {
  if(!native[kind]) return fail('ENTIDADE_INVALIDA');
  if(reference?.pending) return {status:'blocked',blocker:'REFERENCIA_ACOMPANHAMENTO_PENDENTE',expected:null,actual:rows.length,mapping:[]};
  if(!reference||evidence?.reportSha256!==reference.fileSha256) return fail('EVIDENCIA_INVALIDA');
  const field=reference.keyField??native[kind];
  if(![native[kind],business[kind]].includes(field)) return fail('CAMPO_IDENTIDADE_INVALIDO');
  const supplied=field===native[kind]?(evidence.ids??evidence.keys):evidence.keys;
  if(!Array.isArray(supplied)||supplied.length>50000) return fail('EVIDENCIA_INVALIDA');
  const keys=supplied.map(exactId),wanted=new Set(keys);
  if(wanted.size!==keys.length) return fail('CHAVES_RELATORIO_DUPLICADAS');
  if(reference.keys) {
    const fixed=reference.keys.map(exactId);
    if(new Set(fixed).size!==fixed.length||fixed.length!==wanted.size||fixed.some(key=>!wanted.has(key))) return fail('REFERENCIA_RELATORIO_DIVERGENTE');
  }
  const exclusions=checklistExclusions(kind,reference);
  const found=new Map(),seenIds=new Set();
  for(const row of rows) {
    const id=exactId(row.upstream_id),key=field===native[kind]?id:exactId(row.payload?.[field]);
    if(seenIds.has(id)) return fail('ID_ORIGEM_DUPLICADO');
    seenIds.add(id);
    found.set(key,[...(found.get(key)??[]),id]);
  }
  const missing=[...wanted].filter(key=>!found.has(key)).sort();
  const extra=[...found.keys()].filter(key=>!wanted.has(key)).sort();
  const ambiguous=[...found].filter(([,ids])=>ids.length!==1).map(([key,ids])=>({key,ids}));
  const mapping=[...found].filter(([key,ids])=>wanted.has(key)&&ids.length===1).map(([key,ids])=>({key,id:ids[0]})).sort((a,b)=>a.key.localeCompare(b.key));
  const sourceField=reference.exportFilters?.dateField;
  const blocker=sourceField&&sourceField!==reference.filters?.dateField?'ESCOPO_RELATORIO_NAO_COMPARAVEL'
    : reference.collectionScope?.destination && reference.exportScope?.destination && reference.collectionScope.destination!==reference.exportScope.destination ? 'ESCOPO_DESTINO_NAO_COMPARAVEL' : null;
  const commercialScope=exclusions.size ? {
    expected:wanted.size-exclusions.size,
    actual:[...found.values()].reduce((sum,ids)=>sum+ids.length,0)-[...exclusions].reduce((sum,key)=>sum+(found.get(key)?.length??0),0),
    excludedChecklistKeys:[...exclusions].sort(),
    missing:missing.filter(key=>!exclusions.has(key)),extra:extra.filter(key=>!exclusions.has(key)),
    ambiguous:ambiguous.filter(item=>!exclusions.has(item.key)),
    sourceReconciliationRequired:true,
  } : undefined;
  return {...(commercialScope ? {commercialScope} : {}),status:missing.length||extra.length||ambiguous.length?'divergent':blocker?'blocked':'matched',blocker,
    keyField:field,expected:wanted.size,actual:rows.length,missing,extra,ambiguous,mapping};
}

export async function historyReconciliation(db,id) {
  const job=(await db.query('SELECT manifest,phase,state,month_index FROM history_jobs WHERE id=$1',[id])).rows[0];
  if(!job) return fail('CARGA_NAO_ENCONTRADA');
  const months=monthsFor(job.manifest),month=months[Math.min(job.month_index,months.length-1)];
  const references=job.phase==='history'?job.manifest.monthReports[month]:job.manifest.reports;
  const rows=(await db.query('SELECT kind,upstream_id,payload FROM history_records WHERE job_id=$1 AND month=$2',[id,month])).rows;
  const reports={};
  for(const kind of ['attendance','serviceOrders']) {
    const reference=references[kind];
    if(!Array.isArray(reference.keys)&&!Array.isArray(reference.ids)) {
      reports[kind]={status:'blocked',blocker:'CHAVES_RELATORIO_NAO_FORNECIDAS'};continue;
    }
    reports[kind]=compareHistoryReport(kind,rows.filter(row=>row.kind===kind),{reportSha256:reference.fileSha256,keys:reference.keys,ids:reference.ids},reference);
  }
  if(job.manifest.followupCutoff) {
    const reference=references.followup;
    const cohort=(await db.query(`SELECT o.order_id AS upstream_id,o.payload FROM history_followup_orders o JOIN history_followup_attendances a
      ON a.job_id=o.job_id AND a.attendance_id=o.attendance_id WHERE o.job_id=$1 AND a.month=$2`,[id,month])).rows;
    reports.followup=reference.pending?{status:'blocked',blocker:'REFERENCIA_ACOMPANHAMENTO_PENDENTE',actual:cohort.length}
      :Array.isArray(reference.keys)||Array.isArray(reference.ids)?compareHistoryReport('serviceOrders',cohort,{reportSha256:reference.fileSha256,keys:reference.keys,ids:reference.ids},reference)
      :{status:'blocked',blocker:'CHAVES_RELATORIO_NAO_FORNECIDAS',actual:cohort.length};
  }
  const incomplete=rows.filter(row=>row.kind==='attendance'&&row.payload.classification_status==='incomplete');
  const missingFields={};
  for(const row of incomplete) for(const field of String(row.payload.quality_missing_fields??'').split(',')) {
    if(['descricao_abertura','tipo_atendimento'].includes(field)) missingFields[field]=(missingFields[field]??0)+1;
  }
  const quality={incompleteAttendances:incomplete.length,missingFields,requiresExplicitReview:incomplete.length>0};
  return {jobId:id,month,state:job.state,publishable:job.state==='awaiting_validation'&&!incomplete.length&&Object.values(reports).every(r=>r.status==='matched'),quality,reports};
}

// Only references may change. Period, date basis, limits and collected data stay fixed.
export async function attachHistoryReports(pool,id,references) {
  const db=await pool.connect();let locked=false;
  try {
    locked=(await db.query('SELECT pg_try_advisory_lock(73190602) AS locked')).rows[0].locked;
    if(!locked) return fail('SINCRONIZACAO_EM_ANDAMENTO');
    await db.query('BEGIN');
    const job=(await db.query('SELECT * FROM history_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!job||!['planned','paused','awaiting_validation'].includes(job.state)) return fail('ESTADO_NAO_PERMITE_REFERENCIAS');
    const manifest=structuredClone(job.manifest);
    if(job.phase==='history') manifest.monthReports[monthsFor(manifest)[job.month_index]]=references;
    else manifest.reports=references;
    validateManifest(manifest);
    await db.query('UPDATE history_jobs SET manifest=$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(manifest)]);
    await db.query('COMMIT');
    return await historyReconciliation(db,id);
  } catch(error) {await db.query('ROLLBACK');throw error;}
  finally {try{if(locked)await db.query('SELECT pg_advisory_unlock(73190602)');}finally{db.release();}}
}
